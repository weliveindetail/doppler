const express = require('express');
const opn = require('opn');

const cheerio = require('cheerio');
const base64js = require('base64-js');
const puppeteer = require('puppeteer');

const app = express();
const port = 5000;

// TODO: read from blockstack profile
const credentials = {
  user: 'dummy-user-name',
  password: 'dummy-password'
};

function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
}

app.use(allowCrossDomain);
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

app.get('/spawn', function (req, res) {
  (async () => {
    const browser = await puppeteer.launch({headless: false}); // 
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

    try {
      // 1st login page
      {
        res.write(scaledPNG(await page.screenshot(), 'Page 1'));
        const html = await page.content();

        // Type E-Mail
        var input = findElem(html, ['input#Email', 'input[type=text]']);
        if (!input)
          throw 'Failed to detect text input for E-Mail in HTML: \n' + html;
        await page.type(input, credentials.user, {delay: 100});

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
        await page.type(input, credentials.password, {delay: 100});

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
      await browser.close();
      res.end();
    }
  })();
})
