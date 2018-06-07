const express = require('express');
const opn = require('opn');

const cheerio = require('cheerio');
const base64js = require('base64-js');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;
const public = path.join(__dirname, 'public');

const DefaultChromiumDevice = {
  'name': 'LG Optimus L70 landscape',
  'userAgent': 'Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; LGMS323 Build/KOT49I.MS32310c) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/%s Mobile Safari/537.36',
  'viewport': {
    'width': 640,
    'height': 384,
    'deviceScaleFactor': 1.25,
    'isMobile': true,
    'hasTouch': true,
    'isLandscape': true
  }
};

const readFile = (name, opts = 'utf8') =>
  new Promise((res, rej) => {
    fs.readFile(path.join(public, name), opts, (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });

const getPageHead = () => readFile('ctrl-head.html');
const getPageFoot = () => readFile('ctrl-foot.html');

// global state
var browser;
var device;

function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}

app.use(allowCrossDomain);
app.use(bodyParser.urlencoded({extended: true}));
app.use('/', express.static(path.join(__dirname, '/public')));

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }
  console.log(`server is listening on ${port}`)
  //opn('http://localhost:5000')
})

function findElem(html, selectors) {
  var $ = cheerio.load(html);

  var firstMatch = selectors.find(function(item) {
    return $(item).length > 0;
  });

  if (!firstMatch) {
    console.log(
      'Failed to find elements for:\n' + selectors.join('\n') + '\n\n' +
      'In HTML:\n' + "todo (print DOM or something)\n\n\n\n");
      // html.replace(/<script .*<\/script>/g, '') + '\n\n\n\n'
  }

  return firstMatch;
}

function getDeviceConfig(description) {
  const isComplete = function(d) {
    return d.hasOwnProperty('userAgent') &&
           d.hasOwnProperty('viewport');
  };

  // Complete description given.
  if (isComplete(description)) {
    return {
      name: 'Custom Configuration',
      userAgent: description.userAgent,
      viewport: description.viewport,
    };
  }

  // No complete description, resolve from list of known devices.
  if (description.hasOwnProperty('name')) {
    var knownDevice = devices[description.name];
    if (knownDevice && isComplete(knownDevice)) {
      return knownDevice;
    }
  }

  // Device unknown.
  return null;

  /*{
    'name': 'LG Optimus L70 landscape',
    'userAgent': 'Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; LGMS323 Build/KOT49I.MS32310c) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/%s Mobile Safari/537.36',
    'viewport': {
      'width': 640,
      'height': 384,
      'deviceScaleFactor': 1.25,
      'isMobile': true,
      'hasTouch': true,
      'isLandscape': true
  }*/
}

function extractViewport() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    deviceScaleFactor: window.devicePixelRatio
  };
}

function renderControlPage(req, res) {
  (async () => {
    res.write(await getPageHead());
    res.write('<div class="site-wrapper-inner hide" id="page"></div>');
    res.write('<div class="status-panel hide" id="status-panel"></div>');
    res.write(await getPageFoot());
    res.end();
  })();
}

function openStatusDetails() {
  return ' <a href="#" onclick="$(\'#full-status\').show()">[expand]</a>' +
         ' <a href="#" onclick="$(\'#status-panel\').hide()">[dismiss]</a>' +
         '<div class="hide" id="full-status">';
}

function closeStatusDetails() {
  return '</div>';
}

// Encode and wrap image data
function scaledPNG(data, view, alt) {
  var png = base64js.fromByteArray(data);
  var height = 300; // fixed for now
  var width = (height * view.width) / view.height;

  return '<img src="data:image/png;base64,' + png + '"' +
         '     width="' + width + '" height="' + height + '"' +
         '     alt="' + alt + '"></img>';
}

app.get('/', function (req, res) {
  renderControlPage(req, res);
});

app.post('/init', function (req, res) {
  if (browser) {
    res.send('Please kill your current browser before initializing a new one.');
    return;
  }

  (async () => {
    var config = {};
    if (req.body.hasOwnProperty('headless')) {
      config.headless = req.body.headless;
    }

    browser = await puppeteer.launch(config);
    res.write('Started your browser ');

    const page = await browser.newPage();
    await page.goto('https://www.whatismybrowser.com/detect/what-is-my-user-agent');

    const view = await page.evaluate(extractViewport);
    const img = await page.screenshot();

    res.write(openStatusDetails())
    res.write(scaledPNG(img, view, 'whatismybrowser.com'));
    res.write(closeStatusDetails());
    res.end();
  })();
});

app.post('/kill', function (req, res) {
  if (!browser) {
    res.send('You didn\'t start your browser yet. Nothing to do.');
    return;
  }

  (async () => {
    await browser.close();
    browser = undefined;
    res.send("Closed your browser");
  })();
});

app.post('/device', function (req, res) {
  if (!browser) {
    res.send('Please start your browser before setting the device emulation.');
    return;
  }

  if (!req || !req.hasOwnProperty('body')) {
    res.send('Please submit a device name or a full configuration.');
    return;
  }

  (async () => {
    const config = getDeviceConfig(req.body);
    if (!config) {
      res.send('Failed to infer device emulation');
      return;
    }

    res.write('Emulating device: ' + config.name);
    device = config;

    const page = await browser.newPage();
    await page.emulate(device);
    await page.goto('https://www.whatismybrowser.com/detect/what-is-my-user-agent');

    const view = await page.evaluate(extractViewport);
    const img = await page.screenshot();
    res.write(openStatusDetails());
    res.write(scaledPNG(img, view, 'whatismybrowser.com'));
    res.write(closeStatusDetails());
    res.end();
  })();
});

app.post('/spawn', function (req, res) {
  (async () => {
    const page = await browser.newPage();
    if (device)
      await page.emulate(device);

    await page.goto('https://accounts.google.com');
    const view = await page.evaluate(extractViewport);
    var page1, page2, page3;

    try {
      // 1st login page
      page1 = await page.screenshot();
      {
        const html = await page.content();

        // Type E-Mail
        var input = findElem(html, ['input#Email', 'input[type=text]']);
        if (!input)
          throw 'Failed to detect text input for E-Mail in HTML: \n' + html;
        await page.type(input, req.body.user, {delay: 50});

        // Click next or press Enter
        const loginSubmitted = page.waitForNavigation();
        var nextBtn = findElem(html, ['button#next', 'input[type=button]']);
        if (nextBtn)
          await page.click(nextBtn);
        else
          await page.keyboard.press('Enter'); // button not found, try Enter

        await loginSubmitted;
      }

      // 2nd login page
      page2 = await page.screenshot();
      {
        const html = await page.content();

        // Type password
        var input = findElem(html, ['input#Passwd', 'input[type=password]']);
        if (!input)
          throw 'Failed to detect text input for Password in HTML: \n' + html;
        await page.type(input, req.body.password, {delay: 50});

        // Click sign-in or press Enter
        const passwordSubmitted = page.waitForNavigation();
        var signInBtn = findElem(html, ['button#signIn', 'input[type=button]']);
        if (signInBtn)
          await page.click(signInBtn);
        else
          await page.keyboard.press('Enter'); // button not found, try Enter

        await passwordSubmitted;
      }

      page3 = await page.screenshot();

      res.write('Signed in to Google');
      res.write(openStatusDetails());
      res.write(scaledPNG(page1, view, 'Page1'));
      res.write(scaledPNG(page2, view, 'Page2'));
      res.write(scaledPNG(page3, view, 'Page3'));
      res.write(closeStatusDetails());
      res.end();
    }
    catch(msg) {
      res.write('Sign-in to Google failed: ' + msg);
      res.write(openStatusDetails());
      if (page1) res.write(scaledPNG(page1, view, 'Page1'));
      if (page2) res.write(scaledPNG(page2, view, 'Page2'));
      if (page3) res.write(scaledPNG(page3, view, 'Page3'));
      res.write(closeStatusDetails());
      res.end();
    }
  })();
});
