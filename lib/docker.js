// Copyright © 2016 Jan Keromnes. All rights reserved.
// The following code is covered by the AGPL-3.0 license.

var dockerode = require('dockerode');
var exec = require('child_process').exec;
var fs = require('fs');

var db = require('./db');

// Available Docker certificates and hosts.
var client = {};
var dockers = {};
load();


// Load Docker client certificates and host configurations.

function load () {

  // Load the default CA and client certificates synchronously.
  client.ca = fs.readFileSync('ca.crt', 'utf8');
  client.crt = fs.readFileSync('client.crt', 'utf8');
  client.key = fs.readFileSync('client.key', 'utf8');

  // Get all host configurations.
  var hosts = db.get('dockers');

  // Add `localhost` by default.
  if (!hosts.localhost) {
    hosts.localhost = { host: 'localhost', port: 2376 };
  }

  // Configure all Docker hosts.
  for (var id in hosts) {
    var host = hosts[id];
    dockers[id] = new dockerode({
      protocol: 'https',
      host: host.host,
      port: host.port,
      ca: host.ca || client.ca,
      cert: host.cert || host.crt || client.crt,
      key: host.key || client.key
    });
  }

} // Don't export `load`.


// Use the Docker daemon locally (FIXME: Use remote API instead).

function docker (command, options, callback) {

  var cmd = 'docker --tlsverify --tlscacert=ca.crt --tlscert=client.crt ';
  cmd += '--tlskey=client.key -H=localhost:2376 ';

  switch (command) {
    case 'build':
      cmd += 'build';
      var image = options.image;
      if (image) {
        cmd += ' -t ' + image;
      }
      cmd += ' -';
      break;
    case 'images':
      cmd += 'images';
      break;
    case 'run':
      cmd += 'run -d';
      var ports = options.ports || [];
      ports.forEach(function (port) {
        cmd += ' -p ' + port;
      });
      cmd += ' ' + options.image;
      break;
    default:
      callback('Unauthorized Docker command "' + command + '"');
      return;
  }

  var opts = {
    maxBuffer: 10 * 1024 * 1024 // Allow buffers up to 10MB.
  };

  var child = exec(cmd, opts, function (error, stdout, stderr) {
    callback(error, stdout, stderr);
  });

  if (options.stdin) {
    child.stdin.setEncoding('utf8');
    child.stdin.end(options.stdin);
  }

} // Don't export `docker`.


// Build a Docker image with a given Docker command.

function buildImage (image, command, callback) {

  var options = {
    image: image,
    stdin: command + '\n'
  };

  docker('build', options, function (error, stdout, stderr) {
    var logs = 'STDERR:\n' + stderr + '\n\nSTDOUT:\n' + stdout;
    callback(error, logs);
  });

}

exports.buildImage = buildImage;


// Start a new Docker container from a given image.

function runContainer (image, ports, callback) {

  var options = {
    image: image,
    ports: ports
  }

  docker('run', options, function (error, stdout, stderr) {
    var logs = 'STDERR:\n' + stderr + '\n\nSTDOUT:\n' + stdout;
    callback(error, logs);
  });

}

exports.runContainer = runContainer;