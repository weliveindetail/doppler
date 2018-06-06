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

$(function(event) {
  if (blockstack.isUserSignedIn()) {
    var profile = blockstack.loadUserData().profile

    if ($('#page-welcome').length > 0) {
      var person = new blockstack.Person(profile)
      $('#heading-name').html(person.name() ? person.name() : "Nameless Person")
      if(person.avatarUrl()) {
        $('#avatar-image').attr('src', person.avatarUrl())
      }
      $('#page-welcome').css({display: 'block'});

      $('#spawn-button').click(function(event) {
        event.preventDefault();
        submitPostData('/spawn', {user: 'user@host.tld', password: '1234'});
      });
    }

    $('#signout-button').click(function(event) {
      event.preventDefault();
      blockstack.signUserOut(window.location.href);
    });
  }
  else if (blockstack.isSignInPending()) {
    blockstack.handlePendingSignIn().then(function(userData) {
      window.location = window.location.origin
    })
  }
  else {
    $('#page-landing').css({display: 'block'});

    $('#signin-button').click(function(event) {
      event.preventDefault();
      blockstack.redirectToSignIn();
    });
  }
})
