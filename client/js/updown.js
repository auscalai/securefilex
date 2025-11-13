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
                    self.tryDecrypt(cachedData, seed, progress, done, "Wrong password");
                })
                .progress(progress);
        }).fail(function() {
            progress('cancelled');
        });
    },
    downloadfromident: function (seed, progress, done, identResult) {
        var xhr = new this.requestframe.contentWindow.XMLHttpRequest();
        xhr.onload = this.downloaded.bind(this, seed, progress, done);
        xhr.open('GET', (upload.config.server ? upload.config.server : '') + 'i/' + identResult.ident);
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
            done(cachedData); 
        }
    },
    encrypted: function (progress, done, twoFAData, aesData) {
        var finalBlob;
        
        if (twoFAData) {
            var enc = new TextEncoder(); 
            var authBuffer = enc.encode(twoFAData.data); 
            var lengthBuffer = new ArrayBuffer(4);
            var lengthView = new DataView(lengthBuffer);
            lengthView.setUint32(0, authBuffer.byteLength, false);
            
            // Magic bytes for type identification
            var magicBytes;
            if (twoFAData.type === 'face') {
                magicBytes = new Uint8Array([70, 65, 67, 69]); // "FACE"
            } else if (twoFAData.type === 'totp') {
                magicBytes = new Uint8Array([84, 79, 84, 80]); // "TOTP"
            }
            
            finalBlob = new Blob([
                aesData.encrypted,
                authBuffer,
                magicBytes,
                lengthBuffer
            ], { type: 'application/octet-stream' });
        } else {
            finalBlob = aesData.encrypted;
        }
        
        var formdata = new FormData();
        formdata.append('api_key', upload.config.api_key);
        formdata.append('ident', aesData.ident);
        formdata.append('file', finalBlob);
        
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
        }).done(done.bind(undefined, aesData))
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
        crypt.ident(seed).done(function(identResult) {
            self.checkAuthAndProceed(identResult, seed, progress, done);
        }).fail(function(err) {
            progress('error');
        });
    },
    checkAuthAndProceed: function(identResult, seed, progress, done) {
        var self = this;
        $.get('/check_auth_type/' + identResult.ident)
            .done(function(authResult) {
                if (authResult.authType === 'face') {
                    console.log("File has Face Auth. Starting face verification.");
                    self.handleFaceAuthDownload(identResult, seed, progress, done);
                } else if (authResult.authType === 'totp') {
                    console.log("File has TOTP Auth. Starting TOTP verification.");
                    self.handleTOTPAuthDownload(identResult, seed, progress, done);
                } else {
                    console.log("No 2FA. Proceeding with password-only download.");
                    if (self.cached_seed == seed) {
                        self.tryDecrypt(self.cached, seed, progress, done, null);
                    } else {
                        var onFileDownloaded = function(cachedData) {
                            self.tryDecrypt(cachedData, seed, progress, done, null);
                        };
                        self.downloadfromident(seed, progress, onFileDownloaded, identResult);
                    }
                }
            })
            .fail(function() {
                console.warn("Auth check failed. Proceeding with normal download.");
                if (self.cached_seed == seed) {
                    self.tryDecrypt(self.cached, seed, progress, done, null);
                } else {
                    var onFileDownloaded = function(cachedData) {
                        self.tryDecrypt(cachedData, seed, progress, done, null);
                    };
                    self.downloadfromident(seed, progress, onFileDownloaded, identResult);
                }
            });
    },
    handleFaceAuthDownload: function(identResult, seed, progress, done) {
        var self = this;
        if (typeof window.getFaceScan !== 'function') {
            console.error("Face scan prompt function (window.getFaceScan) not found.");
            progress('error');
            return;
        }
        
        function attemptVerification(errorMsg) {
            window.getFaceScan(errorMsg).done(function(faceDataUri) {
                progress('verifying_face');
                
                fetch('/verify_face/' + identResult.ident, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ faceDataUri: faceDataUri })
                })
                .then(function(response) {
                    if (response.ok) {
                        return response.blob();
                    } else {
                        return response.text().then(function(text) {
                            var errorMsg = 'Face verification failed. Server returned ' + response.status;
                            try {
                                var errorJson = JSON.parse(text);
                                if (errorJson && errorJson.error) {
                                    errorMsg = errorJson.error;
                                }
                            } catch (e) {
                                if (text && text.trim().charAt(0) !== '<') {
                                    errorMsg = text;
                                }
                                console.error("Failed to parse error JSON, using fallback.");
                            }
                            var err = new Error(errorMsg);
                            err.data = { status: response.status, body: text };
                            throw err;
                        });
                    }
                })
                .then(function(responseBlob) {
                    if(window.stopFaceScan) window.stopFaceScan();
                    self.cache(seed, responseBlob);
                    self.tryDecrypt(responseBlob, seed, progress, done, null);
                })
                .catch(function(err) {
                    var errorMsg = err.message || "Face verification failed. Please try again.";
                    console.error("Face verification failed:", errorMsg, (err.data || ''));
                    attemptVerification(errorMsg); 
                });

            }).fail(function(err) {
                console.log("Face scan cancelled by user.", err);
                progress('cancelled');
            });
        }

        attemptVerification(null);
    },
    
    handleTOTPAuthDownload: function(identResult, seed, progress, done) {
        var self = this;
        if (typeof window.getTOTPCode !== 'function') {
            console.error("TOTP prompt function (window.getTOTPCode) not found.");
            progress('error');
            return;
        }
        
        function attemptVerification(errorMsg) {
            progress('waiting_for_totp');
            
            window.getTOTPCode(errorMsg).done(function(totpCode) {
                progress('verifying_totp');
                
                fetch('/verify_totp/' + identResult.ident, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: totpCode })
                })
                .then(function(response) {
                    if (response.ok) {
                        return response.blob();
                    } else {
                        return response.text().then(function(text) {
                            var errorMsg = 'TOTP verification failed.';
                            try {
                                var errorJson = JSON.parse(text);
                                if (errorJson && errorJson.error) {
                                    errorMsg = errorJson.error;
                                }
                            } catch (e) {
                                if (text && text.trim().charAt(0) !== '<') {
                                    errorMsg = text;
                                }
                            }
                            var err = new Error(errorMsg);
                            err.data = { status: response.status, body: text };
                            throw err;
                        });
                    }
                })
                .then(function(responseBlob) {
                    if(window.stopTOTPPrompt) window.stopTOTPPrompt();
                    self.cache(seed, responseBlob);
                    self.tryDecrypt(responseBlob, seed, progress, done, null);
                })
                .catch(function(err) {
                    var errorMsg = err.message || "TOTP verification failed. Please try again.";
                    console.error("TOTP verification failed:", errorMsg, (err.data || ''));
                    attemptVerification(errorMsg);
                });

            }).fail(function(err) {
                console.log("TOTP verification cancelled by user.", err);
                progress('cancelled');
            });
        }

        attemptVerification(null);
    },

    upload: function (blob, progress, done, password, twoFAData) {
        crypt.encrypt(blob, blob.name, password)
            .done(this.encrypted.bind(this, progress, done, twoFAData))
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