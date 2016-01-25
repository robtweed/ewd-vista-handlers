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

  25 January 2016

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
    }
  },
  login: {
    GET: function(ewd, session) {
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



module.exports = {
 onReady: function() {
   return {
     messageHandlers: {
       vista_rest: function(messageObj) {
         if (ewdChild.Custom.handlerExtensionModule) {
           var extraHandlers = require(ewdChild.Custom.handlerExtensionModule);
           for (var name in extraHandlers) {
             handler[name] = extraHandlers[name];
           }
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
             }
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
               var util = require('util');
               if (session.isAuthenticated) {
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
               return handler['login'][method](ewdx, session);
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