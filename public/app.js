$(function(event) {
  if (blockstack.isUserSignedIn()) {
    showControlPage('#page');
  }
  else if (blockstack.isSignInPending()) {
    // User was redirected to sign-in page. Go back when done.
    blockstack.handlePendingSignIn().then(function(userData) {
      window.location = window.location.origin
    })
  }
  else {
    // Show heading and link to sign-in.
    showSigninPage('#page');
  }
});

function showSigninPage(div) {
  $(div).html(`
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="signin-button">
        Sign In with Blockstack
      </a>
    </p>
  `);

  $('#signin-button').click(function(event) {
    event.preventDefault();
    blockstack.redirectToSignIn();
  });

  $(div).show();
}

function showControlPage(div) {
  $(div).html(`
    <div class="column" id="page-client"></div>
    <div class="column" id="page-server"></div>`);

  fillColumnClient('#page-client');
  fillColumnServer('#page-server');

  $(div).show();
}

function fillColumnClient(div) {
  $(div).html(`
    <h2>Client Settings</h2>
    <div class="avatar-section">
      <img src="https://s3.amazonaws.com/onename/avatar-placeholder.png"
           class="img-rounded avatar" id="avatar-image">
    </div>
    <h4><span id="heading-name">Anonymous</span></h4>
    <p class="lead">
      <p class="loading hide" id="waiting-credentials">
        <span>.</span><span>.</span><span>.</span>
      </p>
      <form class="hide" id="credentials-form">
        <label for="user-input" id="user-label">Username</label>
        <input type="text" name="user" id="user-input"></input><br>
        <label for="password-input" id="password-label">Password</label>
        <input type="password" name="password" id="password-input"></input>
      </form>
      <a href="#" class="btn btn-primary btn-lg" id="submit-data-button">
        Enter Data
      </a>
      <a href="#" class="btn btn-primary btn-lg" id="delete-data-button">
        Delete Data
      </a>
    </p>
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="signout-button">
        Logout
      </a>
    </p>
  `);

  // Fill in actual profile information.
  var profile = blockstack.loadUserData().profile;
  var person = new blockstack.Person(profile);
  $('#heading-name').html(person.name() ? person.name() : "Nameless Person")
  if (person.avatarUrl()) {
    $('#avatar-image').attr('src', person.avatarUrl())
  }

  // Define action for signout.
  $('#signout-button').click(function(event) {
    event.preventDefault();
    blockstack.signUserOut(window.location.href);
  });

  // Define action for deleting blockstack data.
  $('#delete-data-button').click(function(event) {
    event.preventDefault();
    blockstack.putFile('credentials.json', JSON.stringify({}));
    $('#user-input').val('');
    $('#password-input').val('');
  });

  // Define action for storing data in blockstack.
  $('#submit-data-button').click(function(event) {
    event.preventDefault();

    var form = $('#credentials-form');
    if (form.css('display') != 'block') {
      $('#waiting-credentials').show();

      // Fill in current values.
      blockstack.getFile("credentials.json")
        .then((fileContents) => {
          let c = JSON.parse(fileContents || '{}');
          if (c.hasOwnProperty('user')) {
            $('#user-input').val(c.user);
          }
          if (c.hasOwnProperty('password')) {
            $('#password-input').val(c.password);
          }
        })
        .finally(() => {
          $('#submit-data-button').text('Submit');
          $('#waiting-credentials').hide();
          form.show();
        });
    }
    else {
      let c = {
        user: requiredInput('#user-input', '#user-label'),
        password: requiredInput('#password-input', '#password-label')
      };

      if (c.user && c.password) {
        blockstack.putFile('credentials.json', JSON.stringify(c))
          .then(() => {
            form.hide();
            $('#waiting-credentials').show();
          })
          .catch(e => {
            console.log('Error: ', e);
            alert(e.message);
          })
          .finally(() => {
            $('#submit-data-button').text('Enter Data');
            $('#waiting-credentials').hide();
          });
      }
    }
  });
}

function fillColumnServer(div) {
  $(div).html(`
    <h2>Server Actions</h2>
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="create-browser-button">
        Start Browser
      </a>
    </p>
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="device-emulation-button">
        Configure iPhone 5
      </a>
    </p>
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="google-signin-button">
        Google Sign-in
      </a>
    </p>
    <p class="lead">
      <a href="#" class="btn btn-primary btn-lg" id="kill-browser-button">
        Kill Browser
      </a>
    </p>
  `);

  $('#create-browser-button').click(function(event) {
    event.preventDefault();
    submitPostData('/init', {headless: true});
  });

  $('#kill-browser-button').click(function(event) {
    event.preventDefault();
    submitPostData('/kill', {});
  });

  $('#device-emulation-button').click(function(event) {
    event.preventDefault();
    submitPostData('/device', {name: 'iPhone 5'});
  });

  // Define action for spawning an automated process.
  $('#google-signin-button').click(function(event) {
    event.preventDefault();

    blockstack.getFile("credentials.json")
      .then((fileContents) => {
        let c = JSON.parse(fileContents || '{}');
        if (c.hasOwnProperty('user') && c.hasOwnProperty('password')) {
          submitPostData('/spawn', c);
        }
      })
      .catch(e => {
        console.log('Error: ', e);
        alert(e.message);
      });
  });
}

function requiredInput(input, label) {
  let val = $(input).val();
  if (typeof val === 'string' && val.length > 0) {
    $(label).removeClass('label-error-highlight');
    return val;
  }
  else {
    $(label).addClass('label-error-highlight');
    return null;
  }
}

function submitPostData(url, params) {
  var form = $('<form></form>').attr({action: url, method: 'post'});

  for(var key in params) {
    form.append($('<input></input>').attr({
      type: 'hidden',
      name: key,
      value: params[key]
    }));
  }

  $('#status-panel').html('Working..');
  $('#status-panel').show();
  var aggregatedStatus = '';

  $.post(url, form.serialize()).always(function(status) {
    aggregatedStatus += ' ' + status;
    $('#status-panel').html(aggregatedStatus);
  });
}
