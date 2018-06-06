const express = require('express');
const opn = require('opn');

const cheerio = require('cheerio');
const base64js = require('base64-js');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const port = 5000;

function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
}

app.use(allowCrossDomain);
//app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use('/', express.static(__dirname + '/public'));

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }
  console.log(`server is listening on ${port}`)
  opn('http://localhost:5000')
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

app.get('/', function (req, res) {
  res.write(getPageHead());

  // Client selects what's shown
  res.write(getPageLandingContent());
  res.write(getPageWelcomeContent());

  res.write(getPageFoot());
  res.end();
});

app.post('/spawn', function (req, res) {
  // TODO: don't dump password!
  console.log('Signing you in to Google with: ', req.body);

  const credentials = {
    user: req.body.user,
    password: req.body.password
  };

  (async () => {
    const browser = await puppeteer.launch(); // {headless: false}
    const page = await browser.newPage();
    await page.goto('https://accounts.google.com');

    // Get viewport as reported by the page
    const dims = await page.evaluate(() => {
      return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        deviceScaleFactor: window.devicePixelRatio
      };
    });

    // Encode and wrap image data
    var scaledPNG = function(data, alt) {
      var png = base64js.fromByteArray(data);
      var width = 400; // fixed for now
      var height = (width * dims.height) / dims.width;
      return '<img src="data:image/png;base64,' + png + '" ' +
                  'width="' + width + '" height="' + height + '"' +
                  'alt="' + alt + '" />'
    };

    res.write(getPageHead());
    res.write("<h1>Signing you in to Google..</h1>");

    try {
      // 1st login page
      {
        res.write(scaledPNG(await page.screenshot(), 'Page 1'));
        const html = await page.content();

        // Type E-Mail
        var input = findElem(html, ['input#Email', 'input[type=text]']);
        if (!input)
          throw 'Failed to detect text input for E-Mail in HTML: \n' + html;
        await page.type(input, credentials.user, {delay: 50});

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
      {
        res.write(scaledPNG(await page.screenshot(), 'Page 2'));
        const html = await page.content();

        // Type password
        var input = findElem(html, ['input#Passwd', 'input[type=password]']);
        if (!input)
          throw 'Failed to detect text input for Password in HTML: \n' + html;
        await page.type(input, credentials.password, {delay: 50});

        // Click sign-in or press Enter
        const passwordSubmitted = page.waitForNavigation();
        var signInBtn = findElem(html, ['button#signIn', 'input[type=button]']);
        if (signInBtn)
          await page.click(signInBtn);
        else
          await page.keyboard.press('Enter'); // button not found, try Enter

        await passwordSubmitted;
      }

      res.write(scaledPNG(await page.screenshot(), 'Page 3'));
    }
    catch(msg) {
      res.write('Error: ' + msg);
    }
    finally {
      var closing = browser.close();

      res.write(getPageFoot());
      res.end();

      await closing;
    }
  })();
});

function getPageLandingContent() {
  return `
    <div class="panel-landing hide" id="page-landing">
      <h1 class="landing-heading">Hello, Blockstack!</h1>
      <p class="lead">
        <a href="#" class="btn btn-primary btn-lg" id="signin-button">
          Sign In with Blockstack
        </a>
      </p>
    </div>
  `;
}

function getPageWelcomeContent() {
  return `
    <div class="panel-welcome hide" id="page-welcome">
      <div class="avatar-section">
        <img src="https://s3.amazonaws.com/onename/avatar-placeholder.png" class="img-rounded avatar" id="avatar-image">
      </div>
      <h1>Dear <span id="heading-name">Anonymous</span>!</h1>
      <p class="lead">
        <a href="#" class="btn btn-primary btn-lg" id="spawn-button">
          Spawn!
        </a>
      </p>
      <p class="lead">
        <a href="#" class="btn btn-primary btn-lg" id="signout-button">
          Logout
        </a>
      </p>
    </div>
  `;
}

function getPageHead() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Hello, Blockstack!</title>
      <link rel="stylesheet" href="bootstrap.min.css" />
      <link rel="stylesheet" href="app.css" />
      <script src="bundle.js"></script>
      <script src="app.js"></script>
    </head>
    <body>
      <div class="site-wrapper">
        <div class="site-wrapper-inner" id="page">
  `;
}

function getPageFoot() {
  return `
        </div>
      </div>
    </body>
    </html>
  `;
}
