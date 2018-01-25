const xhrInterceptor = (() => {
  if (typeof window === 'undefined' || !window.XMLHttpRequest) {
    throw new Error('This only works with xhr and not node js');
  }

  const xhrSend = XMLHttpRequest.prototype.send;
  const xhrOpen = XMLHttpRequest.prototype.open;

  const INTERCEPTOR_EVENTS = {
    RESPONSE: 'response',
    REQUEST: 'request'
  };

  let state = {
    isIntercepting: false,
    debug: false,
    eventListenerFn() {}
  };

  const islogRequest = (url) => (state.logEndpoint &&
                                  state.logEndpoint.url === url);

  function setState(newPartialState) {
    state = {
      ...state,
      ...newPartialState
    };
  }

  function sendEventToLogEndpoint(event) {
    const req = new XMLHttpRequest();
    const { url, authToken } = state.logEndpoint;

    req.open('POST', url, true);
    req.setRequestHeader('Content-Type', 'application/json');

    if (state.logEndpoint.authToken) {
      req.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }

    req.send(JSON.stringify(event));
  }

  return {
    set debug(value) {
      setState({
        debug: true
      });
    },

    intercept() {
      if (state.isIntercepting === false) {
        setState({
          isIntercepting: true
        });

        XMLHttpRequest.prototype.open = function(method, url, ...thisArgs) {
          const xhr = this;
          xhr.url = url;

          xhrOpen.call(xhr, method, url, ...thisArgs);
        };

        XMLHttpRequest.prototype.send = function(...thisArgs) {
          const reqEvent = {
            eventType: INTERCEPTOR_EVENTS.REQUEST,
            xhr: this,
            sendArgs: thisArgs
          };

          const reqUrl = this.url;

          try {
            // Do not intercept the requests to the log endpoint
            if (!islogRequest(reqUrl)) {
              if (state.debug) {
                console.log('XHR request event URL: %s', reqUrl, reqEvent);
              }

              state.eventListenerFn(reqEvent);
              state.logEndpoint && sendEventToLogEndpoint(reqEvent);
            }
          } catch (err) {
             console.error('xhr Interceptor error: ', err);
          }


          const originalReadyState = this.onreadystatechange;

          this.onreadystatechange = (...stateChangeArgs) => {
            if (this.readyState === XMLHttpRequest.DONE) {
              const resEvent = {
                eventType: INTERCEPTOR_EVENTS.RESPONSE,
                status: this.status,
                statusText: this.statusText,
                response: this.response,
                xhr: this,
                sendArgs: thisArgs
              };

              if (typeof originalReadyState === 'function') {
                originalReadyState.apply(this, stateChangeArgs);
              }

              if (!islogRequest(reqUrl)) {
                if (state.debug) {
                  console.log('XHR response event URL: %s', reqUrl, resEvent);
                }

                // Publish response event
                state.eventListenerFn(resEvent);
                state.logEndpoint && sendEventToLogEndpoint(resEvent);
              }
            }
          };

          // Send the request
          xhrSend.apply(this, thisArgs);
        };
      }
    },

    setListener(fn) {
      setState({ eventListenerFn: fn });
    },

    setLogEndpoint({url, authToken = ''}) {
      setState({
        logEndpoint: {
          url,
          authToken
        }
      });
    },

    stop() {
      if (state.isIntercepting) {
        setState({
          isIntercepting: false
        });

        XMLHttpRequest.prototype.send = xhrSend;
        XMLHttpRequest.prototype.open = xhrOpen;
      }
    }
  };
})();
