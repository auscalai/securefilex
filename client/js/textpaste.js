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
        
        this.current.remove();
        console.log('[textpaste.js] Editor UI removed.');
        
        if (this.closeback) {
            console.log('[textpaste.js] Executing closeback to restore home UI.');
            this.closeback();
        } else {
            console.error('[textpaste.js] FATAL: closeback function not found!');
        }
        
        this.cleanup();
        
        console.log('[textpaste.js] Calling upload.home.doupload().');
        upload.home.doupload(blob);
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
        
        // --- THE FIX IS HERE: The root element is now a <form> tag ---
        var template = `
            <form id="textview" class="d-flex flex-column vh-100">
                <nav class="navbar navbar-expand-lg navbar-dark p-2" style="background-color: var(--card-bg);">
                    <div class="container-fluid">
                        <input id="create_filename" type="text" class="form-control w-auto" value="${filename}">
                        <div class="ms-auto">
                            <button type="button" id="retbtn" class="btn cancel-btn me-2">Go Back</button>
                            <button type="submit" class="btn btn-primary">Save & Encrypt</button>
                        </div>
                    </div>
                </nav>
                <div id="create_text" class="memo-editor-area flex-grow-1 position-relative">
                    <textarea class="memo-editor-textarea"></textarea>
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
    }
});