var message = require('../messagehandler');
var download = require('../../lib/download');
var utils = require('../utils');

"use strict";

function ConsoleFilesystem(syncURL, userid) {
    this.syncURL = syncURL;
    this.userid = userid;
}

ConsoleFilesystem.prototype.TAR = function(path) {
    message.Register("tar", function(d){download(d, "user.tar", "application/x-tar");} );
    message.Send("tar", path);
}

ConsoleFilesystem.prototype.Sync = function(path) {
    message.Register("sync", this.OnSync.bind(this));
    message.Send("sync", path);
}

ConsoleFilesystem.prototype.OnSync = function(d) {
    utils.UploadBinaryResource(this.syncURL, this.userid + ".tar", d,
        function(response) {
            alert(
                "Message from Server:" + response + "\n" +
                "The home folder '/home/user' has been synced with the server\n" +
                "In order to access the data at a later date,\n" +
                "start the next session with the current url with the user id\n" +
                "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.userid+".tar.bz2"
            );
            }.bind(this),
        function(msg) {alert(msg);}
    );
}

ConsoleFilesystem.prototype.UploadExternalFile = function(f) {
    var reader = new FileReader();
    reader.onload = function(e) {
        message.Send("MergeFile",
        {name: "home/user/"+f.name, data: new Uint8Array(reader.result)});
    }.bind(this);
    reader.readAsArrayBuffer(f);
}

ConsoleFilesystem.prototype.MergeFile = function(fileName, data) {
  function stringToUint(string) {
    var charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
  }
  message.Send("MergeFile", {name: fileName, data: stringToUint(data)});
}

ConsoleFilesystem.prototype.MergeBinaryFile = function(fileName, data) {
  message.Send("MergeFile", {name: fileName, data: data});
}

ConsoleFilesystem.prototype.CreateDirectory = function(dirctoryName) {
    message.Send("CreateDirectory", dirctoryName );
}

ConsoleFilesystem.prototype.ReadFile = function(fileName, callback) {
  console.log("(ReadFile");
  message.Register("ReadFile", callback);
  message.Send("ReadFile", { name: fileName });
}

//deletes contents of specified directory.
ConsoleFilesystem.prototype.DeleteDirContents = function(dirPath) {
    message.Send("DeleteDirContents", dirPath);
}

//deletes file, recursively deletes dir
ConsoleFilesystem.prototype.DeleteNode = function(nodeName) {
    message.Send("DeleteNode", nodeName);
}

ConsoleFilesystem.prototype.Rename = function(oldPath, newPath) {
    message.Send("Rename", {oldPath:oldPath, newPath: newPath});
}

ConsoleFilesystem.prototype.WatchFile = function(fileName, callback) {
  message.Register("WatchFileEvent", callback);
  message.Send("WatchFile", { name: fileName });
}

ConsoleFilesystem.prototype.WatchDirectory = function(directoryPath, callback) {
  message.Register("WatchDirectoryEvent", callback);
  message.Send("WatchDirectory", { name: directoryPath });
}

module.exports = ConsoleFilesystem;
