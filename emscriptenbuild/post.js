/**
 * Javascript functions for emscripten http transport for nodejs and the browser using a webworker
 * 
 * If you can't use a webworker, you can build Release-async or Debug-async versions of wasm-git
 * which use async transports, and can be run without a webworker. The lg2 release files are about
 * twice the size with this option, and your UI may be affected by doing git operations in the
 * main JavaScript thread.
 * 
 * This the non-webworker version (see also post-async.js)
 */

const emscriptenhttpconnections = {};
let httpConnectionNo = 0;
Object.assign(Module, {
    emscriptenhttpconnect: function(url, buffersize, method, headers) {
        if(!method) {
            method = 'GET';
        }

        const xhr = new XMLHttpRequest();
        xhr.open(method, url, false);
        xhr.responseType = 'arraybuffer';

        if (headers) {
            Object.keys(headers).forEach(header => xhr.setRequestHeader(header, headers[header]));
        }

        emscriptenhttpconnections[httpConnectionNo] = {
            xhr: xhr,
            resultbufferpointer: 0,
            buffersize: buffersize
        };
        
        if(method === 'GET') {
            xhr.send();
        }

        return httpConnectionNo++;
    },
    emscriptenhttpwrite: function(connectionNo, buffer, length) {
        const connection = emscriptenhttpconnections[connectionNo];
        const buf = new Uint8Array(Module.HEAPU8.buffer,buffer,length).slice(0);
        if(!connection.content) {
            connection.content = buf;
        } else {
            const content = new Uint8Array(connection.content.length + buf.length);
            content.set(connection.content);
            content.set(buf, connection.content.length);
            connection.content = content;
        }            
    },
    emscriptenhttpread: function(connectionNo, buffer, buffersize) { 
        const connection = emscriptenhttpconnections[connectionNo];
        if(connection.content) {
            connection.xhr.send(connection.content.buffer);
            connection.content = null;
        }
        let bytes_read = connection.xhr.response.byteLength - connection.resultbufferpointer;
        if (bytes_read > buffersize) {
            bytes_read = buffersize;
        }
        const responseChunk = new Uint8Array(connection.xhr.response, connection.resultbufferpointer, bytes_read);
        writeArrayToMemory(responseChunk, buffer);
        connection.resultbufferpointer += bytes_read;
        return bytes_read;
    },
    emscriptenhttpfree: function(connectionNo) {
        delete emscriptenhttpconnections[connectionNo];
    }
});