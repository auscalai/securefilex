upload.modules.addmodule({
    name: 'textpaste',
    init: function () {
      $(document)
          .on('submit', '#textview', this.save.bind(this))
          .on('click', '#retbtn', this.closethis.bind(this))
          .on('keydown', (e) => {
              if (this.current && (e.ctrlKey || e.metaKey) && e.which === 83) {
                  this.save(e);
              }
          });
    },
    unrender: function() {
        if (this.current) this.current.remove();
        this.cleanup();
    },
    save: function(e) {
        e.preventDefault();
        console.log('[textpaste] Saving memo.');
        
        const blob = new Blob([this.current.find('textarea').val()], {
            type: this.current.find('#create_mime').val()
        });
        blob.name = this.current.find('#create_filename').val();
        
        const closeback = this.closeback;
        this.current.remove();
        this.cleanup();
        
        if (closeback) closeback();
        
        // Use a short timeout to ensure the home UI is restored before upload begins
        setTimeout(() => upload.home.doupload(blob), 50);
    },
    cleanup: function() {
      delete this.closeback;
      delete this.current;
    },
    closethis: function() {
      console.log('[textpaste] Closing editor.');
      if (this.closeback) this.closeback();
      this.current.remove();
      this.cleanup();
    },
    render: function(view, filename, data, mime, closeback) {
        console.log('[textpaste] Rendering editor.');
        const template = `
            <form id="textview" class="d-flex flex-column vh-100">
                <nav class="navbar navbar-dark memo-navbar">
                    <div class="container-fluid">
                        <div class="d-flex align-items-center flex-grow-1">
                            <i class="bi bi-file-text-fill me-2" style="font-size: 1.5rem; color: var(--primary-glow);"></i>
                            <input id="create_filename" type="text" class="form-control memo-filename-input" value="${filename}" placeholder="Enter filename...">
                        </div>
                        <div class="ms-auto d-flex gap-2">
                            <button type="button" id="retbtn" class="btn cancel-btn"><i class="bi bi-arrow-left me-2"></i>Go Back</button>
                            <button type="submit" class="btn btn-primary"><i class="bi bi-lock-fill me-2"></i>Save & Encrypt</button>
                        </div>
                    </div>
                </nav>
                <div class="memo-editor-area flex-grow-1 position-relative">
                    <div class="memo-editor-wrapper">
                        <textarea class="memo-editor-textarea" placeholder="Start typing your memo..." spellcheck="true"></textarea>
                        <div class="memo-editor-stats">
                            <span id="char-count"></span> <span class="separator">•</span>
                            <span id="word-count"></span> <span class="separator">•</span>
                            <span id="line-count"></span>
                        </div>
                    </div>
                </div>
                <input type="hidden" id="create_mime" value="${mime}">
            </form>
        `;

        this.current = $(template).appendTo(view);
        this.closeback = closeback;
        
        const area = this.current.find('textarea');
        area.val(data).focus()[0].setSelectionRange(0, 0);
        
        this.updateStats(area);
        area.on('input', () => this.updateStats(area));
    },
    updateStats: function(textarea) {
        const text = textarea.val();
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const lines = text.split('\n').length;
        
        this.current.find('#char-count').text(`${chars} character${chars !== 1 ? 's' : ''}`);
        this.current.find('#word-count').text(`${words} word${words !== 1 ? 's' : ''}`);
        this.current.find('#line-count').text(`${lines} line${lines !== 1 ? 's' : ''}`);
    }
});