$(function(event) {
  if (blockstack.isUserSignedIn()) {
    if ($('#page-welcome').length > 0) {
      // Fill in actual client data and decide what parts
      // of the page should be visible.
      showWelcomePage();
    }
    else {
      // Some action is running, render whatever the server does.
    }
  }
  else if (blockstack.isSignInPending()) {
    // User was redirected to sign-in page. Go back when done.
    blockstack.handlePendingSignIn().then(function(userData) {
      window.location = window.location.origin
    })
  }
  else {
    // Show heading and link to sign-in.
    showSigninPage();
  }
})

function showSigninPage() {
  $('#page-landing').show();

  $('#signin-button').click(function(event) {
    event.preventDefault();
    blockstack.redirectToSignIn();
  });
}

function showWelcomePage() {
  // Fill in actual profile information.
  var profile = blockstack.loadUserData().profile
  var person = new blockstack.Person(profile)
  $('#heading-name').html(person.name() ? person.name() : "Nameless Person")
  if (person.avatarUrl()) {
    $('#avatar-image').attr('src', person.avatarUrl())
  }

  // Define action for signout.
  $('#signout-button').click(function(event) {
    event.preventDefault();
    blockstack.signUserOut(window.location.href);
  });

  // Define action for data submission.
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

  // Define action for spawning an automated process.
  $('#spawn-button').click(function(event) {
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

  // Make the whole content visible.
  $('#page-welcome').show();
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

  $('body').append(form);
  form.submit();
}
