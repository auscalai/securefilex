upload.modules.addmodule({
    name: 'textpaste',
    init: function () {
      $(document).on('submit', '#textview', this.save.bind(this));
      $(document).on('click', '#retbtn', this.closethis.bind(this));
      $(document).on('keydown', this.keypress.bind(this));
    },
    keypress: function(e) {
      if (!this.current) return;
      if (!(e.which == 83 && (e.ctrlKey || e.metaKey))) return;
      this.save(e);
    },
    unrender: function() {
        if (this.current) {
            this.current.remove();
        }
        this.cleanup();
    },
    save: function(e) {
        if(e) e.preventDefault();
        console.log('[textpaste.js] "Save Memo" clicked.');
        
        var blob = new Blob([this.current.find('textarea').val()], {
            type: this.current.find('#create_mime').val()
        });
        blob.name = this.current.find('#create_filename').val();
        console.log('[textpaste.js] Memo blob created:', blob);
        
        // Store the closeback before removing UI
        var closeback = this.closeback;
        
        this.current.remove();
        console.log('[textpaste.js] Editor UI removed.');
        
        this.cleanup();
        
        // Execute closeback FIRST to restore home UI
        if (closeback) {
            console.log('[textpaste.js] Executing closeback to restore home UI.');
            closeback();
        }
        
        // Small delay to ensure UI is ready before starting upload
        setTimeout(() => {
            console.log('[textpaste.js] Calling upload.home.doupload().');
            upload.home.doupload(blob);
        }, 50);
    },
    cleanup: function() {
      console.log('[textpaste.js] Cleaning up module state.');
      delete this['closeback'];
      delete this['current'];
    },
    closethis: function() {
      console.log('[textpaste.js] "Go Back" clicked.');
      var closeback = this.closeback;
      this.current.remove();
      this.cleanup();
      if (closeback) {
          closeback();
      }
    },
    render: function(view, filename, data, mime, closeback) {
        console.log('[textpaste.js] Rendering memo editor.');
        
        var template = `
            <form id="textview" class="d-flex flex-column vh-100">
                <nav class="navbar navbar-expand-lg navbar-dark memo-navbar">
                    <div class="container-fluid">
                        <div class="d-flex align-items-center flex-grow-1">
                            <i class="bi bi-file-text-fill me-2" style="font-size: 1.5rem; color: var(--primary-glow);"></i>
                            <input id="create_filename" type="text" class="form-control memo-filename-input" value="${filename}" placeholder="Enter filename...">
                        </div>
                        <div class="ms-auto d-flex gap-2">
                            <button type="button" id="retbtn" class="btn cancel-btn">
                                <i class="bi bi-arrow-left me-2"></i>Go Back
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-lock-fill me-2"></i>Save & Encrypt
                            </button>
                        </div>
                    </div>
                </nav>
                <div id="create_text" class="memo-editor-area flex-grow-1 position-relative">
                    <div class="memo-editor-wrapper">
                        <textarea class="memo-editor-textarea" placeholder="Start typing your memo..." spellcheck="true"></textarea>
                        <div class="memo-editor-stats">
                            <span id="char-count">0 characters</span>
                            <span class="separator">•</span>
                            <span id="word-count">0 words</span>
                            <span class="separator">•</span>
                            <span id="line-count">1 line</span>
                        </div>
                    </div>
                </div>
                <input type="hidden" id="create_mime" value="${mime}">
            </form>
        `;

        this.current = $(template);
        view.append(this.current);
        this.closeback = closeback;
        
        var area = this.current.find('textarea');
        area.val(data).focus()[0].setSelectionRange(0, 0);
        area.scrollTop(0);
        
        // Add character/word/line counter
        this.updateStats(area);
        area.on('input', () => this.updateStats(area));
    },
    
    updateStats: function(textarea) {
        var text = textarea.val();
        var chars = text.length;
        var words = text.trim() ? text.trim().split(/\s+/).length : 0;
        var lines = text.split('\n').length;
        
        this.current.find('#char-count').text(`${chars} character${chars !== 1 ? 's' : ''}`);
        this.current.find('#word-count').text(`${words} word${words !== 1 ? 's' : ''}`);
        this.current.find('#line-count').text(`${lines} line${lines !== 1 ? 's' : ''}`);
    }
});