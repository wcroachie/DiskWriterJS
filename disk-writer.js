!function(){

  function randomId(){
    return Math.random().toString(36).slice(2);
  }

  /* for get requests, add a random param to prevent caching */
  function randomParam(){
    return randomId() + "=" + randomId();
  }

  DiskWriter = class DiskWriter{

    get [Symbol.toStringTag](){
      return this.constructor.name;
    }

    #closed = false;
    #errored = false;
    #queue = [];
    #res = null;

    close(){
      if( this.#closed ){
        throw "this DiskWriter was already closed.";
      }
      this.#closed = true;
      return new Promise( res => this.#res = res );
    }

    feed( ui8 ){
      if( this.#closed ){
        throw "cannot feed a closed DiskWrtier.";
      }
      this.#queue.push( ui8 );
    }

    onerror = null;

    /* httpsIframeURL - required. the url that points to the service worker iframe */
    constructor( httpsIframeURL, filename=Math.random().toString(36).slice(2), lastModified=new Date() ){

      /* strip hash and params in case url has that, and then add a random param to prevent caching */
      httpsIframeURL = httpsIframeURL.split(/#/)[0].split(/\?/)[0] + "?" + randomParam();
      
      let _this = this;

      let iframe = document.documentElement.appendChild( document.createElement("iframe") );

      iframe.style.display = "none";
      iframe.hidden = true;
      iframe.name = (new Date(lastModified)*1) + ";" + filename;
      iframe.src = httpsIframeURL;

      function waitForIframeToSay( msgData ){
        return new Promise( res => {
          function handler(e){
            if( e.source === iframe.contentWindow && e.data === msgData ){
              res();
              removeEventListener( "message", handler );
            }
          }
          addEventListener("message",handler);
        });
      }

      function swLogsListener(e){
        if( e.source === iframe.contentWindow && e.data[0] === "swlogs" ){
          let logs = e.data[1];
          for( let log of logs ){
            /* sometimes ff doesnt let you inspect the object so stringify it here */
            let str = JSON.stringify( log, null, "  " );
            if( log.subject === "error" ){
              console.error( str );
              typeof _this.onerror === "function" && _this.onerror( JSON.parse( str ) );
              /**
               * since the sw is stuck and cannot write
               * to the disk, we need to use #errored
               * to force the pump function to end.
               **/
              _this.#errored = true;
            }else if( log.subject === "warn" ){
              console.warn( str );
            }else{
              console.log( str );
            }
          }
        }
      }
      
      function cleanup(){
        iframe.remove();
        removeEventListener( "message", swLogsListener );
      }

      addEventListener( "message", swLogsListener );

      /* listen for iframe to say "ready" */
      waitForIframeToSay("ready").then( () => {

        /* begin pumping */
        !function pump(){

          if( _this.#errored ){
            /* dump the queue and remove the iframe, return early */
            _this.#closed = true;
            _this.#queue = [];
            cleanup();
            return;
          }

          if( _this.#queue.length ){
            let ui8 = _this.#queue.shift();
            iframe.contentWindow.postMessage( ui8, "*" );
          }

          if( _this.#closed && !_this.#queue.length ){
            /* tell the iframe to finish up */
            iframe.contentWindow.postMessage("close","*");
            /* wait for iframe to send message that says "done", then remove it */
            waitForIframeToSay("done").then( () => {
              cleanup();
              _this.#res();
            });
            return;
          }

          setTimeout( pump );

        }();

      });
    
    }

  }

}()