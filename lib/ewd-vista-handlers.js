/*

 ----------------------------------------------------------------------------
 | ewd-vista-handlers.js:                                                   |
 |  EWD.js REST Interface for VistA: Child Process Custom Message Handlers  |
 |                                                                          |
 | Copyright (c) 2016 M/Gateway Developments Ltd,                           |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  28 January 2016

*/

var vistaSecurity = require('ewd-vista-security');
var vistaRPC = require('ewd-vista-rpc');

function setewd(messageObj) {
  // Create ewd object just like standard EWD.js Web Service interface
  return {
    query: messageObj.params.query,
    post_data: messageObj.params.post_data,
    headers: messageObj.params.headers,
    method: messageObj.params.method,
    path: messageObj.params.path || '',
    mumps: mumps,
    globals: mumps,
    db: db,
    util: EWD,
    module: ewdChild.module,
    log: ewdChild.log,
    logFile: ewdChild.logFile,
    map: {
      global: ewdChild.global,
      routine: ewdChild.routine,
    },
    sendWebServiceResponse: function(json, contentType) {
      EWD.sendWebServiceResponse(json, contentType);
    },
    GraphQL: ewdChild.GraphQL,
    Custom: ewdChild.Custom
   };
}

function login(ewd, session) {
  if (!ewd.query) {
    return {
      error: {
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Security credentials are missing'
      }
    }
  }

  if (session.isAuthenticated) {
    return {
      error: {
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Client is already logged in'
      }
    }
  }
  var status = vistaSecurity.login(ewd, session);
  if (status.error) {
    return {
      error: {
        statusCode: status.error.statusCode,
        statusMessage: status.error.statusMessage,
        message: status.error.text
      }
    }
  }
  else {
    session.setAuthenticated();
    return {
      content: status,
      action: 'login'
    };
  }
}

var handler = {
  runRPC: {
    GET: function(ewd, session) {
      var pathArr = ewd.path.split('/');
      var rpcName = pathArr[0];
      rpcName = rpcName.split('%20').join(' ');
      if (rpcName === 'XUS SIGNON SETUP' || rpcName === 'XUS AV CODE') {
        return {
          statusCode: 403,
          statusMessage: 'Forbidden',
          message: 'RPC cannot be used as a REST request'
        }
      }
      else {
        var typeUC;
        var inputs = [];
        for (var type in ewd.query) {
          if (type === 'format') continue;
          typeUC = type.toUpperCase();
          if (typeof ewd.query[type] === 'string') {
            inputs.push({
              type: typeUC,
              value: ewd.query[type]
            });
          }
          else {
            for (var i = 0; i < ewd.query[type].length; i++) {
              inputs.push({
                type: typeUC,
                value: ewd.query[type][i]
              });
            }
          }
        }
        var params = {
          rpcName: rpcName,
          rpcArgs: inputs
        };
        if (ewd.query.format) params.format = ewd.query.format;
        var response = vistaRPC.run(params, session, ewd);

        return {
          content: response,
          action: 'runRPC'
        };
      }
    },
    POST: function(ewd, session) {
      var pathArr = ewd.path.split('/');
      var rpcName = pathArr[0];
      rpcName = rpcName.split('%20').join(' ');
      if (rpcName === 'XUS SIGNON SETUP' || rpcName === 'XUS AV CODE') {
        return {
          statusCode: 403,
          statusMessage: 'Forbidden',
          message: 'RPC cannot be used as a REST request'
        }
      }
      else {
        // normalise input JSON
        if (Array.isArray(ewd.post_data)) {
          var obj;
          var type;
          var nameUC;
          var value;
          var newObj;
          for (var i = 0; i < ewd.post_data.length; i++) {
            obj = ewd.post_data[i];
            if (obj.type) {
              obj.type = obj.type.toUpperCase();
            }
            if (typeof obj.value === 'string') {
              obj.value = obj.value.toUpperCase();
            }
            else {
              newObj = {};
              for (var name in obj.value) {
                nameUC = name.toUpperCase();
                newObj[nameUC] = obj.value[name];
              }
              obj.value = newObj;
            }
            ewd.post_data[i] = obj;
          }
        }
        // 
        var params = {
          rpcName: rpcName,
          rpcArgs: ewd.post_data
        };
        if (ewd.query && ewd.query.format) params.format = ewd.query.format;
        var response = vistaRPC.run(params, session, ewd);

        return {
          content: response,
          action: 'runRPC'
        };
      }
    }
  },
  login: {
    GET: function(ewd, session) {
      return login(ewd, session);
    },
    POST: function(ewd, session) {
      if (ewd.post_data) {
        if (!ewd.query) ewd.query = {};
        if (ewd.post_data.accessCode) ewd.query.accessCode = ewd.post_data.accessCode;
        if (ewd.post_data.verifyCode) ewd.query.verifyCode = ewd.post_data.verifyCode;
      }
      return login(ewd, session);
    }
  },
  initiate: {
    GET: function(ewd, session) {
      var results = vistaSecurity.initiate('vista', ewd);
      return {
        content: results,
        action: 'initiate'
      };
    }
  }
};

var postLogin = function(ewd, session) {
  console.log('**** default postLogin does nothing');
};


module.exports = {
 onReady: function() {
   return {
     messageHandlers: {
       vista_rest: function(messageObj) {
         var extModule;
         if (ewdChild.Custom.handlerExtensionModule) {
           extModule = require(ewdChild.Custom.handlerExtensionModule);
           var extraHandlers = extModule.handlers;
           for (var name in extraHandlers) {
             handler[name] = extraHandlers[name];
           }
           if (extModule.postLogin) postLogin = extModule.postLogin;
         }
         delete ewdChild.Custom.handlerExtensionModule;

         var action = messageObj.action;
         var method = messageObj.params.method;
         // Confirm existence of handler for action/method combination specified
         if (typeof handler[action] === 'undefined' || typeof handler[action][method] === 'undefined') {
           return {
             error: {
               statusCode: 400,
               statusMessage: 'Bad Request',
               message: method + ' handler for action ' + action + ' is not available'
             }
           };
         }
         // Set up ewd object
         var ewdx = setewd(messageObj);
         if (action !== 'initiate') {
           // check for existence and validity of Authorization header token:
           var auth = vistaSecurity.authenticate(ewdx);
           if (auth.ok) {
             var session = auth.session;
             if (action !== 'login') {
               // check that user has logged
               if (session.isAuthenticated) {
                 if (action === 'runRPC' && ewdChild.Custom.runRPC && ewdChild.Custom.runRPC.REST === false) {
                   return {
                     error: {
                       statusCode: 403,
                       statusMessage: 'Forbidden',
                       message: 'RPCs cannot be invoked directly via REST requests'
                     }
                   };
                 }

                 // ** OK run handler for this action & method
                 return handler[action][method](ewdx, session);
               }
               else {
                 // Not allowed to invoke RPCs unless logged in
                 return {
                   error: {
                     statusCode: 400,
                     statusMessage: 'Bad Request',
                     message: 'You must be logged in to execute RPCs'
                   }
                 }
               }
             }
             else {
               // allow client to attempt to log in
               var loginResults = handler['login'][method](ewdx, session);
               if (postLogin) {
                 postLogin(ewdx, session);
               }
               return loginResults;
             }
           }
           else {
             // Failed authentication
             var error = auth.error;
             return {
               error: {
                 statusCode: error.statusCode,
                 statusMessage: error.statusMessage,
                 message: error.text
               }
             }
           }
         }
         else {
           // allow client to initiate
           return handler['initiate'][method](ewdx, session);
         }
       }
     }
   }
 }
};