'use strict';

var Container = require('../../lib/container');
var json = require('../../lib/middleware/json');

var chaiAsPromised = require("chai-as-promised");

var chai = require('chai');

chai.use(chaiAsPromised);

var expect = chai.expect;

var emptyMsg = {content: new Buffer(''), properties: {contentType: 'application/json'}};
var jsonMsg = {content: new Buffer('{"foo": "bar"}'), properties: {contentType: 'application/json'}};
var textMsg = {content: new Buffer('Hello world!'), properties: {contentType: 'application/text'}};
var unknownMsg = {content: new Buffer('Hello world!'), properties: {contentType: undefined}};
var noContentTypeJsonMsg = {content: new Buffer('{"foo": "bar"}'), properties: {contentType: undefined}};

describe('JSON Middleware', function () {

  var jsonDecode = json();
  var container = new Container();

  before(function () {
    container.init();
  });

  after(function () {
    container.shutdown();
  });

  it('should be rejected with empty msg', function (done) {
    return expect(jsonDecode(emptyMsg)).to.eventually.be.rejectedWith(Error).and.notify(done);
  });

  it('should be resolved with a JSON msg', function (done) {
    return expect(jsonDecode(jsonMsg)).to.eventually.have.property("body").and.notify(done);
  });

  it('should be resolved with a non JSON msg and skip decoding', function (done) {
    return expect(jsonDecode(textMsg)).to.eventually.not.have.property("body").and.notify(done);
  });

  it('should be resolved with missing contentType and skip decoding', function (done) {
    return expect(jsonDecode(unknownMsg)).to.eventually.not.have.property("body").and.notify(done);
  });

  it('should be resolved with success if a valid JSON body and ignore content type is set', function (done) {
    var jsonDecode = json({ignoreContentType: true});
    return expect(jsonDecode(noContentTypeJsonMsg)).to.eventually.have.property("body").and.notify(done);
  });

  it('should setup a route and consume json', function (done) {

    container.use(jsonDecode);

    var open = container.route('$jsontest.*.events', {queue: 'test_events_json'}, function (msg) {
      msg.ack();
      expect(msg).to.have.property('body');
      done();
    });

    setTimeout(
      function () {

        open.then(function (conn) {
          var ok = conn.createChannel();
          ok = ok.then(function (ch) {
            ch.publish('amq.topic', '$jsontest.123456.events', new Buffer(JSON.stringify({msg: 'some message'})), {contentType: 'application/json'});
          });
          return ok;
        }).then(null, console.warn);
      }, 100);

  });

  it('should setup a route and call error on bad json', function (done) {

    container.use(jsonDecode);

    function onError(err) {
      expect(err).to.exist;
      done();
    }

    var open = container.route('$jsontest.*.events.err', {queue: 'test_events_json_err', errorHandler: onError}, function (msg) {
    });

    setTimeout(
      function () {

        open.then(function (conn) {
          var ok = conn.createChannel();
          ok = ok.then(function (ch) {
            ch.publish('amq.topic', '$jsontest.123456.events.err', new Buffer('{msg: "some message"}'), {contentType: 'application/json'});
          });
          return ok;
        }).then(null, console.warn);
      }, 100);

  });

});