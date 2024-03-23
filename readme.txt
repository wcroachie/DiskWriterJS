DiskWriter - progressive download streams, for every browser, simplified.


* OVERVIEW *

This is a small library I wrote to allow you to initiate download streams on the client without a server.

In this way you can download very large files without having to store them in memory (i.e. like with blob urls) and without having the need for a server to set the headers. It brings a similar functionality that the FileSystemHandle API in Chromium to browsers like Firefox and Safari until they catch up, and gives chrome users a stable tried-and-true alternative if FileSystemHandle does not work as expected.

The library was written from the ground up but it is inspired by Jimmy Warting's StreamSaver library and is an attempt to improve and simplify the methods used there. Like StreamSaver, it uses a service worker to trigger a download on the client by adding a 'Content-Disposition: attachment...' header to the response headers, and a ReadableStream as the response body. Uint8Arrays can then be pumped into the ReadableStream over a long period of time to write a file to the client's Downloads folder of any size.

AFAICT, this is the only way of doing this without a server.


* USAGE *

The two files in the "https" folder should be hosted by you over https, i.e. in a folder on your github.io site, on a neocities site, what have you. As for the script itself, all you have to do is include it inline like so, and it creates a single DiskWriter class in the global scope.

  <script src="path/to/disk-writer.js"></script>

To create a DiskWriter instance, simply do the following:

  const dw = new DiskWriter( "https://www.my-site.wherever/disk-writer/index.html", "filename.extension", new Date() );

The first argument is the url where you are hosting the index.html and service worker, the second argument is the suggested filename for the download, and the third argument is an optional lastModified parameter to provide for the 'Last-Modified' header in the response, should the environment permit that for the download (if unsuccessful it just defaults to the current date). If a filename is not provided, it will just use a random string with no extension.

To feed a chunk of data into the DiskWriter instance, simply call the following:

  dw.feed( ui8 );

Where "ui8" must be a Uint8Array. It is pushed into the DiskWriter's queue and is then fed into the download stream.

To close the DiskWriter instance, simply call the following:

  dw.close().then( () => {
    console.log("done");
  });

After it is closed, the DiskWriter cannot be reused. A new one must be created if you want to make another download stream.

Errors can be handled using the optional onerror handler, like so:

  dw.onerror = err => console.error( err );

If it encounters an error in writing to disk, the DiskWriter instance will close immediately and will (attempt to) save however much of the partial file was downloaded to the disk. This is due to the nature of ReadableStreams.
