var vistaRPC = require('ewd-vista-rpc');

var handler = {
  patient: {
    GET: function(ewd, session) {
      //invokeRPC('ORWPT SELECT?literal=' + patientId + '&format=raw')
      var args = {
        rpcName: 'ORWPT SELECT',
        rpcArgs: [{
          type: 'LITERAL',
          value: ewd.query.patientId
        }],
      };
      var response = vistaRPC.run(args, session, ewd);
      return {
        content: response,
        action: 'patient'
      };
    }
  }
};

function postLogin(ewd, session) {
  session.$('VistA').$('division')._value = 100;
}

module.exports = {
  handlers: handler,
  postLogin: postLogin
};