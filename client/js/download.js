function setupPasswordPrompt() {
    if (window.getPassword) { return; }
    var modal = $('<div>').attr('id', 'password_modal').addClass('modal hidden password-modal-global');
    var card = $('<div>').addClass('boxarea password-card-global');
    var title = $('<h2>').text('Enter Decryption Password').addClass('password-title-global');
    var input = $('<input>').prop('type', 'password').prop('placeholder', 'Password')
                            .prop('id', 'decryption_password').addClass('password-input-global');
    var btn = $('<button>').addClass('btn password-btn-global').text('Decrypt');
    var errorMsg = $('<div>').attr('id', 'password_error_msg')
                             .addClass('password-error-global')
                             .css({minHeight: '1.2em'});
    card.append(title, input, btn, errorMsg);
    modal.append(card);
    $('body').append(modal);
    var currentDeferred = null;
    var submitPassword = function() {
        var password = input.val();
        if (!password) {
            window.showPasswordError("Please enter a password.");
            return;
        }
        if (currentDeferred) {
            currentDeferred.resolve(password);
            currentDeferred = null;
        }
    };
    btn.on('click', function(e) {
        e.preventDefault();
        submitPassword();
    });
    input.on('keypress', function(e) {
        if (e.which === 13) {
             e.preventDefault();
             submitPassword();
        }
    });
    window.getPassword = function(errorMsg) {
        if (currentDeferred) {
            currentDeferred.reject('Cancelled by new request');
        }
        currentDeferred = $.Deferred();
        modal.removeClass('hidden');
        $('#decryption_password').val('');
        $('#password_error_msg').text(errorMsg || '');
        $('#decryption_password').focus();
        anime.remove(card[0]);
        if (errorMsg) {
            anime({
                targets: card[0],
                translateX: [-10, 10, -10, 10, 0],
                duration: 300,
                easing: 'easeInOutSine'
            });
        } else {
            anime({
                targets: card[0],
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutQuad'
            });
        }
        return currentDeferred.promise();
    };
    window.showPasswordError = function(msg) {
        modal.removeClass('hidden'); 
        $('#password_error_msg').text(msg || 'Incorrect password. Please try again.');
        $('#decryption_password').val('');
        $('#decryption_password').focus();
        anime.remove(card[0]);
        anime({
            targets: card[0],
            translateX: [-10, 10, -10, 10, 0],
            duration: 300,
            easing: 'easeInOutSine'
        });
    }
}
setupPasswordPrompt();

function setupFaceScanPrompt() {
    if (window.getFaceScan) { return; }
    var modal = $('<div>').attr('id', 'download_face_modal').addClass('modal hidden password-modal-global');
    var card = $('<div>').addClass('boxarea password-card-global').attr('id', 'download_face_modal_card');
    var title = $('<h2>').text('Facial Verification Required').addClass('password-title-global');
    var p = $('<p>').text('Please center your face in the camera to verify.').css({marginBottom: '25px', color: '#eee', opacity: 0.8});
    var webcamContainer = $('<div>').attr('id', 'download_face_webcam_container');
    var video = $('<video>').attr('id', 'download_face_webcam').attr('autoplay', true).attr('playsinline', true);
    var canvas = $('<canvas>').attr('id', 'download_face_canvas');
    var spinner = $('<div>').attr('id', 'download_face_spinner').addClass('hidden').html('<div class="spinner"></div>');
    webcamContainer.append(video, canvas, spinner);
    var btnCapture = $('<button>').addClass('btn password-btn-global').text('Verify My Face').attr('id', 'download_capture_face_btn');
    var btnSkip = $('<button>').addClass('btn password-btn-global cancel-btn').text('Cancel Download').attr('id', 'download_skip_face_btn');
    var errorMsg = $('<div>').attr('id', 'download_face_error_msg').addClass('password-error-global').css({minHeight: '1.2em'});
    card.append(title, p, webcamContainer, btnCapture, btnSkip, errorMsg);
    modal.append(card);
    $('body').append(modal);
    var currentDeferred = null;
    var webcam = new Webcam(video[0], 'user', canvas[0]);
    $('#download_capture_face_btn').on('click', function() {
        var faceDataUri = webcam.snap();
        if (!faceDataUri) {
            $('#download_face_error_msg').text("Failed to capture image. Please try again.");
            return;
        }
        if (currentDeferred) {
            spinner.removeClass('hidden');
            $('#download_face_error_msg').text('');
            currentDeferred.resolve(faceDataUri);
            currentDeferred = null;
        }
    });
    $('#download_skip_face_btn').on('click', function() {
        webcam.stop();
        modal.addClass('hidden');
        if (currentDeferred) {
            currentDeferred.reject('User cancelled face scan.');
            currentDeferred = null;
        }
    });
    window.getFaceScan = function(errorMsgText) {
        if (currentDeferred) {
            currentDeferred.reject('Cancelled by new request');
        }
        currentDeferred = $.Deferred();
        modal.removeClass('hidden');
        spinner.addClass('hidden');
        $('#download_face_error_msg').text(errorMsgText || '');
        anime.remove(card[0]);
        if (errorMsgText) {
             anime({
                targets: card[0],
                translateX: [-10, 10, -10, 10, 0],
                duration: 300,
                easing: 'easeInOutSine'
            });
        } else {
            anime({
                targets: card[0],
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutQuad'
            });
        }
        webcam.start()
            .then(function(result) { console.log("Download webcam started"); })
            .catch(function(err) {
                console.error("Error starting download webcam:", err);
                $('#download_face_error_msg').text("Could not start webcam. Please allow camera access.");
            });
        return currentDeferred.promise();
    };
    window.stopFaceScan = function() {
        webcam.stop();
        modal.addClass('hidden');
        if (currentDeferred) {
            currentDeferred.reject('Verification complete');
            currentDeferred = null;
        }
    }
}
setupFaceScanPrompt();

function setupTOTPPrompt() {
    if (window.getTOTPCode) { return; }
    var modal = $('<div>').attr('id', 'download_totp_modal').addClass('modal hidden password-modal-global');
    var card = $('<div>').addClass('boxarea password-card-global');
    var title = $('<h2>').text('TOTP Verification Required').addClass('password-title-global');
    var p = $('<p>').text('Enter the 6-digit code from Google Authenticator.').css({marginBottom: '25px', color: '#eee', opacity: 0.8});
    var input = $('<input>').prop('type', 'text').prop('placeholder', '000000')
                            .prop('id', 'download_totp_input').prop('maxlength', 6)
                            .addClass('password-input-global')
                            .css({fontFamily: 'monospace', textAlign: 'center', fontSize: '24px', letterSpacing: '4px'});
    var btn = $('<button>').addClass('btn password-btn-global').text('Verify Code');
    var btnCancel = $('<button>').addClass('btn password-btn-global cancel-btn').text('Cancel Download');
    var errorMsg = $('<div>').attr('id', 'download_totp_error_msg')
                             .addClass('password-error-global')
                             .css({minHeight: '1.2em'});
    card.append(title, p, input, btn, btnCancel, errorMsg);
    modal.append(card);
    $('body').append(modal);
    
    var currentDeferred = null;
    
    // Format input to only allow digits
    input.on('input', function(e) {
        var value = e.target.value.replace(/\D/g, '');
        input.val(value);
    });
    
    var submitCode = function() {
        var code = input.val();
        if (code.length !== 6) {
            $('#download_totp_error_msg').text("Please enter a 6-digit code.");
            anime.remove(card[0]);
            anime({
                targets: card[0],
                translateX: [-10, 10, -10, 10, 0],
                duration: 300,
                easing: 'easeInOutSine'
            });
            return;
        }
        if (currentDeferred) {
            currentDeferred.resolve(code);
            currentDeferred = null;
        }
    };
    
    btn.on('click', function(e) {
        e.preventDefault();
        submitCode();
    });
    
    input.on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            submitCode();
        }
    });
    
    btnCancel.on('click', function() {
        modal.addClass('hidden');
        if (currentDeferred) {
            currentDeferred.reject('User cancelled TOTP verification.');
            currentDeferred = null;
        }
    });
    
    window.getTOTPCode = function(errorMsgText) {
        if (currentDeferred) {
            currentDeferred.reject('Cancelled by new request');
        }
        currentDeferred = $.Deferred();
        modal.removeClass('hidden');
        input.val('');
        $('#download_totp_error_msg').text(errorMsgText || '');
        input.focus();
        anime.remove(card[0]);
        if (errorMsgText) {
            anime({
                targets: card[0],
                translateX: [-10, 10, -10, 10, 0],
                duration: 300,
                easing: 'easeInOutSine'
            });
        } else {
            anime({
                targets: card[0],
                scale: [0.9, 1],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutQuad'
            });
        }
        return currentDeferred.promise();
    };
    
    window.stopTOTPPrompt = function() {
        modal.addClass('hidden');
        if (currentDeferred) {
            currentDeferred.reject('Verification complete');
            currentDeferred = null;
        }
    }
}
setupTOTPPrompt();

upload.modules.addmodule({
    name: 'download',
    delkeys: {},
    template: '<div class="modulecontent" id="dlarea"><div class="topbar"><h1 id="downloaded_filename"></h1><div class="viewswitcher"><a id="editpaste" class="btn">Edit Memo</a><a class="btn" id="newupload" href="#">New Locker</a></div></div><div id="downloaddetails"></div><div id="btnarea"><a class="btn" id="dlbtn" href="#">Download</a><a class="btn" id="inbrowserbtn" target="_blank" href="#">View In Browser</a><a class="btn" id="deletebtn" href="#">Delete</a></div></div>',
    init: function () {
      $(document).on('click', '#editpaste', this.editpaste.bind(this))
    },
    route: function (routeroot, content) {
        if (!routeroot && content) {
            return this;
        }
        return false;
    },
    render: function (view) {
        view.html(this.template)
        this._ = {}
        this._.view = view
        this._.detailsarea = view.find('#downloaddetails')
        this._.filename = view.find('#downloaded_filename')
        this._.btns = view.find('#btnarea')
        this._.deletebtn = view.find('#deletebtn')
        this._.dlbtn = view.find('#dlbtn')
        this._.viewbtn = view.find('#inbrowserbtn')
        this._.viewswitcher = view.find('.viewswitcher')
        this._.newupload = view.find('#newupload')
        this._.editpaste = view.find('#editpaste')
        this._.dlarea = view.find('#dlarea')
        this._.title = $('title')
        this._.content = {}
        this._.content.main = this._.content.loading = $('<h1>').prop('id', 'downloadprogress').addClass('centertext centerable').text('Initializing...');
        this._.detailsarea.empty().append(this._.content.main);
        $('#footer').hide()
    },
    initroute: function (content, contentroot) {
        contentroot = contentroot ? contentroot : content;
        delete this._['text'];
        this._.filename.hide();
        this._.title.text("SecureFile Locker");
        this._.btns.hide();
        this._.editpaste.hide();
        this._.newupload.hide();
        this._.dlarea.show(); 
        this._.content.loading.text('Initializing Locker Download...');
        this._.deletebtn.hide();
        upload.updown.download(content, this.progress.bind(this), this.downloaded.bind(this));
    },
    unrender: function () {
        this._.title.text('SecureFile Locker')
        delete this['_']
    },
    assocations: {
      'application/javascript': 'text',
      'application/x-javascript': 'text',
      'application/xml': 'text',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/x-pdf': 'pdf',
      'text/plain': 'text',
      'audio/aac': 'audio',
      'audio/mp4': 'audio',
      'audio/mpeg': 'audio',
      'audio/ogg': 'audio',
      'audio/wav': 'audio',
      'audio/webm': 'audio',
      'video/mp4': 'video',
      'video/ogg': 'video',
      'video/webm': 'video',
      'audio/wave': 'audio',
      'audio/wav': 'audio',
      'audio/x-wav': 'audio',
      'audio/x-pn-wav': 'audio',
      'audio/vnd.wave': 'audio',
      'image/tiff': 'image',
      'image/x-tiff': 'image',
      'image/bmp': 'image',
      'image/x-windows-bmp': 'image',
      'image/gif': 'image',
      'image/x-icon': 'image',
      'image/jpeg': 'image',
      'image/pjpeg': 'image',
      'image/png': 'image',
      'image/webp': 'image',
      'text/': 'text'
    },
    safeassocations: {
        'text': 'text/plain',
        'svg': 'text/plain'
    },
    getassociation: function(mime) {
        for (var key in this.assocations) {
            if (mime.startsWith(key)) {
                return this.assocations[key]
            }
        }
    },
    setupLineNumbers: function(ele) {
      var markup = ele.html()
      ele.html('<div class="line">' + markup.replace(/\n/g, '</div><div class="line">') + '</div>')
      ele.find('.line').each(function(i, e) {
        $(e).prepend($('<span>').addClass('linenum').text(i + 1))
      })
    },
    downloaded: function (data) {
        $('#password_modal').addClass('hidden');
        $('#download_face_modal').addClass('hidden');
        $('#download_totp_modal').addClass('hidden');
        this._.filename.text(data.header.name);
        this._.title.text(data.header.name + ' - SecureFile Locker');
        var stored = localStorage.getItem('delete-' + data.ident);
        if (stored && !isiframed()) {
            this._.deletebtn.show().prop('href', (upload.config.server ? upload.config.server : '') + 'del?delkey=' + stored + '&ident=' + data.ident);
        }
        this._.newupload.show();
        var association = this.getassociation(data.header.mime);
        var safemime = this.safeassocations[association];
        var decrypted = new Blob([data.decrypted], { type: data.header.mime });
        var safedecrypted = new Blob([decrypted], { type:  safemime ? safemime : data.header.mime });
        var url = URL.createObjectURL(decrypted);
        var safeurl = URL.createObjectURL(safedecrypted);
        this._.viewbtn.prop('href', safeurl).hide();
        this._.dlbtn.prop('href', url);
        this._.dlbtn.prop('download', data.header.name);
        delete this._['content'];
        this._.detailsarea.empty();
        if (!!association) {
            this._.viewbtn.show();
        }
        if (association == 'image' || association == 'svg') {
            var imgcontent = $('<div>').prop('id', 'previewimg').addClass('preview centerable').appendTo(this._.detailsarea);
            var previewimg = $('<img>').addClass('dragresize').appendTo(imgcontent).prop('src', url);
        } else if (association == 'text') {
            var textcontent = $('<div>').prop('id', 'downloaded_text').addClass('preview').addClass('previewtext').appendTo(this._.detailsarea);
            var pre = $('<pre>').appendTo(textcontent);
            var code = $('<code>').appendTo(pre);
            var fr = new FileReader();
            fr.onload = function () {
                var text = fr.result;
                this._.text = {};
                this._.text.header = data.header;
                this._.text.data = text;
                code.text(text);
                hljs.highlightBlock(code[0]);
                this.setupLineNumbers(code);
            }.bind(this);
            fr.readAsText(data.decrypted);
            this._.editpaste.show();
        } else if (association == 'video') {
            $('<div>').addClass('preview centerable').append($('<video>').prop('controls', true).prop('autoplay', true).prop('src', url)).appendTo(this._.detailsarea);
        } else if (association == 'audio') {
            $('<div>').addClass('preview centerable').append($('<audio>').prop('controls', true).prop('autoplay', true).prop('src', url)).appendTo(this._.detailsarea);
        } else {
            $('<div>').addClass('preview').addClass('downloadexplain centerable centertext').text("Click Download below to download file. Locker self-destructs 24 hours after creation.").appendTo(this._.detailsarea);
        }
        this._.filename.show();
        this._.btns.show();
    },
    closepaste: function() {
      this._.dlarea.show()
    },
    editpaste: function() {
      this._.dlarea.hide()
      upload.textpaste.render(this._.view, this._.text.header.name, this._.text.data, this._.text.header.mime, this.closepaste.bind(this))
    },
    progress: function (e) {
        if (!this._.content || !this._.content.loading) {
            return;
        }
        switch(e) {
            case 'decrypting':
                this._.content.loading.text('Decrypting Locker...');
                break;
            case 'error':
                this._.content.loading.text('Locker Not Found. Lockers self-destruct after 24 hours.');
                this._.newupload.show();
                break;
            case 'waiting_for_password':
                 this._.content.loading.text('Locker is protected. Please enter password.');
                 break;
            case 'waiting_for_face':
                 this._.content.loading.text('Locker is protected. Please verify your face.');
                 break;
            case 'verifying_face':
                 this._.content.loading.text('Verifying face...');
                 break;
            case 'waiting_for_totp':
                 this._.content.loading.text('Locker is protected. Please enter TOTP code.');
                 break;
            case 'verifying_totp':
                 this._.content.loading.text('Verifying TOTP code...');
                 break;
            case 'cancelled':
                 this._.content.loading.text('Decryption cancelled by user.');
                 this._.newupload.show();
                 break;
            default:
                var text = '';
                if (e.eventsource != 'encrypt') {
                    text = 'Downloading Locker';
                } else {
                    text = 'Decrypting Locker';
                }
                var percent = (e.loaded / e.total) * 100;
                if (percent >= 99) {
                     this._.content.loading.text(text + ' 99% (Verifying...)');
                } else {
                     this._.content.loading.text(text + ' ' + Math.floor(percent) + '%');
                }
        }
    }
});