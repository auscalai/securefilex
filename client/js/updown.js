upload.modules.addmodule({
    name: 'updown',
    init: function () {
        this.requestframe = document.createElement('iframe');
        this.requestframe.src = 'about:blank';
        this.requestframe.style.visibility = 'hidden';
        document.body.appendChild(this.requestframe);
    },

    tryDecrypt: function (cachedData, seed, progress, done, errorMsg) {
        var self = this;

        if (typeof window.getPassword !== 'function') {
            console.error("Password prompt function (window.getPassword) not found.");
            progress('error');
            return;
        }
        
        if (!errorMsg) {
            progress('waiting_for_password');
        }
        
        window.getPassword(errorMsg).done(function(password) {
            
            progress('decrypting');
            crypt.decrypt(cachedData, seed, password)
                .done(function(result) {
                    done(result);
                })
                .fail(function(err) {
                    console.error("Decryption failed:", err);
                    self.tryDecrypt(cachedData, seed, progress, done, "Wrong password");
                })
                .progress(progress);

        }).fail(function() {
            progress('cancelled');
        });
    },

    downloadfromident: function (seed, progress, done, ident) {
        var xhr = new this.requestframe.contentWindow.XMLHttpRequest();
        xhr.onload = this.downloaded.bind(this, seed, progress, done);
        xhr.open('GET', (upload.config.server ? upload.config.server : '') + 'i/' + ident.ident);
        xhr.responseType = 'blob';
        xhr.onerror = this.onerror.bind(this, progress);
        xhr.addEventListener('progress', progress, false);
        xhr.send();
    },
    onerror: function (progress) {
        progress('error');
    },
    downloaded: function (seed, progress, done, response) {
        if (response.target.status != 200) {
            this.onerror(progress);
        } else {
            var self = this;
            var cachedData = response.target.response;
            this.cache(seed, cachedData);
            self.tryDecrypt(cachedData, seed, progress, done, null);
        }
    },
    encrypted: function (progress, done, data) {
        var formdata = new FormData();
        formdata.append('api_key', upload.config.api_key);
        formdata.append('ident', data.ident);
        formdata.append('file', data.encrypted);
        
        $.ajax({
            url: (upload.config.server ? upload.config.server : '') + 'up',
            data: formdata,
            cache: false,
            processData: false,
            contentType: false,
            dataType: 'json',
            xhr: function () {
                var xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', progress, false);
                return xhr;
            },
            type: 'POST'
        }).done(done.bind(undefined, data))
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Upload failed:", textStatus, errorThrown);
            if (progress) {
                progress('error'); 
            }
        });
    },
    cache: function (seed, data) {
        this.cached = data;
        this.cached_seed = seed;
    },
    cacheresult: function (data) {
        this.cache(data.seed, data.encrypted);
    },
    download: function (seed, progress, done) {
        var self = this;
        if (this.cached_seed == seed) {
            self.tryDecrypt(self.cached, seed, progress, done, null);
        } else {
            crypt.ident(seed).done(this.downloadfromident.bind(this, seed, progress, done));
        }
    },
    upload: function (blob, progress, done, password) {
        crypt.encrypt(blob, blob.name, password)
            .done(this.encrypted.bind(this, progress, done))
            .done(this.cacheresult.bind(this))
            .progress(progress)
            .fail(function(err) {
                console.error("Encryption failed:", err);
                if (progress) {
                    progress('error');
                }
            });
    }
});