'use strict';

var url_params = get_url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size']);

$('#type').text(url_params.type);
$('#name').text(url_params.name);

$('img#file-format').attr('src', (function() {
  // url_params.type
  function p(name) {
    return '/img/fileformat/' + name + '.png';
  }
  var name_split = url_params.name.replace(/\.(pgp|gpg)$/ig, '').split('.');
  var extension = name_split[name_split.length - 1].toLowerCase();
  switch(extension) {
    case 'jpg':
    case 'jpeg':
      return p('jpg');
    case 'xls':
    case 'xlsx':
      return p('excel');
    case 'doc':
    case 'docx':
      return p('word');
    case 'png':
      return p('png');
    default:
      return p('generic');
  }
})());

$('#download').click(prevent(doubleclick(), function(self) {
  var original_content = $(self).html();
  $(self).html(get_spinner())
  gmail_api_message_attachment_get(url_params.account_email, url_params.message_id, url_params.attachment_id, function(success, attachment) {
    $(self).html(original_content);
    if(success) {
      var encrypted_data = base64url_decode(attachment.data);
      // todo - following lines pretty much copy/pasted from pgp_block.js. Would use a common function in gmail_elements.js
      var my_prvkey = private_storage_get(localStorage, url_params.account_email, 'master_private_key');
      get_passphrase(url_params.account_email, function(my_passphrase) { //todo - add "waiting for passphrase" spinner
        if(my_passphrase !== null) {
          if(typeof my_prvkey !== 'undefined') {
            var private_key = openpgp.key.readArmored(my_prvkey).keys[0];
            if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
              private_key.decrypt(my_passphrase);
            }
            try {
              var options = {
                message: (encrypted_data.match(/-----BEGIN PGP MESSAGE-----/)) ? openpgp.message.readArmored(encrypted_data) : openpgp.message.read(str_to_uint8(encrypted_data)),
                privateKey: private_key,
                format: 'binary',
              };
              openpgp.decrypt(options).then(function(decrypted) {
                download_file(url_params.name.replace(/(\.pgp)|(\.gpg)$/, ''), url_params.type, decrypted.data);
              }).catch(function(error) {
                console.log(error);
                $('body.attachment').html('Error opening file<br>Downloading original..');
                download_file(url_params.name, url_params.type, encrypted_data);
              });
            } catch(err) {
              $('body.attachment').html('Badly formatted file<br>Downloading original..<br>' + err.message);
              download_file(url_params.name, url_params.type, encrypted_data);
            }
          } else {
            $('body.attachment').html('No private key<br>Downloading original..');
            download_file(url_params.name, url_params.type, encrypted_data);
          }
        } else {
          $('body.attachment').html('Missing passphrase<br>Downloading original..');
          download_file(url_params.name, url_params.type, encrypted_data);
        }
      });
    }
  });
}));
