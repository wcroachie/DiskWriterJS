!function(){
  
  oninstall = () => skipWaiting();
  onactivate = e => e.waitUntil( clients.claim() );
  
  let queue = [];
  let closing = false;
  let closed = false;
  let logs = [];
  
  function getAllPropertyNames(o){
    let s = new Set();
    while( o !== null && o !== Object.prototype ){
      Object.getOwnPropertyNames(o).forEach( e => s.add(e) );
      o = Object.getPrototypeOf(o);
    }
    return [...s];
  }
  
  function normalizeError( errorLike ){
    let clone = {};
    let props = getAllPropertyNames( errorLike );
    for( let prop of props ){
      clone[prop] = prop === "error" ? normalizeError( errorLike[prop] ) : String(errorLike[prop]);
    }
    return clone;
  }
  
  function log( subject=null, body=null ){
    logs.push({
      subject,
      body
    });
  }
  
  addEventListener( "error", e => log( "error", normalizeError(e) ) );
  addEventListener("unhandledrejection", e => log( "error", normalizeError(e) ) );
  
  onmessage = e => {
    if( e.data === "close" ){
      closing = true;
    }else{
      queue.push( e.data );
    }
  };
  
  let stream = new ReadableStream({
    start( ctl ){
      !function pump(){
        
        if( queue.length ){
          let ui8 = queue.shift();
          ctl.enqueue( ui8 );
        }
        
        if( closing && !queue.length ){
          ctl.close();
          closed = true;
          return;
        }
        
        setTimeout( pump );
        
      }();
    },
  });
  
  onfetch = e => {
    
    /* request logs (in case they dont print in debug console ) */
    if( e.request.url.split(/#/)[0].split(/\?/)[0].endsWith("logs") ){    
      e.respondWith( new Response( JSON.stringify(logs) ) );
      logs = [];
      return;
    }
    
    if( e.request.url.split(/#/)[0].split(/\?/)[0].endsWith("ping") ){
      if( closed ){
        /**
        * main.js will ping until it hears "done",
        * then it will tel top window to close 
        * so that it does not close before the stream
        * is done saving
        */
        e.respondWith( new Response("done") );
      }else{
        e.respondWith( new Response("pong") );
      }
      return;
    }
    
    let params = Object.fromEntries( new URL( e.request.url ).searchParams );
    
    if( (e.request.destination === "document" || e.request.destination === "iframe") && ("download" in params) ){
      
      let lastModified = new Date(params.lastmodified*1).toUTCString();
      
      let headers = new Headers({
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Last-Modified': lastModified,
      });
      
      let filename = params.filename;
      
      
      // Make filename RFC5987 compatible
      filename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      headers.set('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
      
      let options = { headers };
      let resp = new Response( stream, options );
      
      e.respondWith( resp );
      
    }
    
  };
  
}()