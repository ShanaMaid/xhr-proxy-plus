import queryString from 'query-string';


const mergeHooks = (pre, next) => {
  const sumKeys = Object.keys({ ...pre , ... next });
  const newHooks = {};
  const passFn = () => true;
  sumKeys.forEach((_) => {
    newHooks[_] = (...p) => {
      const preFn =  pre[_] || passFn;
      const nextFn = next[_] || passFn;
      return preFn(...p) && nextFn(...p);
    };
  });
  return newHooks;
};

if (!window.___XhrProxyInstance) {
  window.___XhrProxyInstance = undefined;
}

/**
 * 多实例合并
 * 把低版本的参数合并到高版本
 */
const mergeInstance = (high, lowParams) => {
  // 单例模式，多次声明直接合并
  if (high) {
    if (lowParams.apiCallback) {
      const lastApiCallback =  high.apiCallback;
      high.apiCallback = (...p) => {
        lastApiCallback(...p);
        lowParams.apiCallback(...p);
      }
    }
    if (lowParams.beforeHooks) {
      high.hooks = mergeHooks(high.hooks, lowParams.beforeHooks)
    }

    if (lowParams.afterHooks) {
      high.execedHooks = mergeHooks(high.execedHooks, lowParams.afterHooks)
    }

    return high;
  }
};

/**
 * a版本高于b则返回true，其余情况都返回false
 */
const versionCompare = (a, b) => {
  if (a !== undefined && b === undefined) {
    return true;
  }
  if (a > b) {
    return true;
  }
  return false;
}

export class XhrProxy {
  // 00.00.19
  version = '000019';

  lastXhrSendStamp = Date.now();
  /**
   * 构造函数
   */
  constructor(params = {}) {
    // 初始化代理函数
    const initXhrProxy = () => {
      this.XHR = window.XMLHttpRequest;

      this.hooks = params.beforeHooks || {};
      this.execedHooks = params.afterHooks || {};
      this.apiCallback= params.apiCallback;
      this.init();
  
      window.___XhrProxyInstance  = this;
    };
  
    if (window.___XhrProxyInstance) {
      const old = window.___XhrProxyInstance;
      if (versionCompare(this.version, window.___XhrProxyInstance.version)) {
        window.___XhrProxyInstance.unset();
        initXhrProxy();
        mergeInstance(this, old)
      } else {
        mergeInstance(old, params);
      }
    } else {
      initXhrProxy();
    }
  }

  /**
   * 初始化 重写xhr对象
   */
  init() {
    let _this = this;

    window.XMLHttpRequest = function () {
      this._xhr = new _this.XHR();
      // 用于记录请求的整个链路路径
      this._xhr.__record = {
        canceled: false,
      };
      this._xhr.__hasCallback = false;
      _this.overwrite(this);
    }
  }

  /**
   * 处理重写
   */
  overwrite(proxyXHR) {
    for (let key in proxyXHR._xhr) {
      if (typeof proxyXHR._xhr[key] === 'function') {
        this.overwriteMethod(key, proxyXHR);
        continue;
      }
      this.overwriteAttributes(key, proxyXHR);
    }
  }

  /**
   * 重写方法
   */
  overwriteMethod(key, proxyXHR) {
    let hooks = this.hooks;
    let execedHooks = this.execedHooks;
  
    proxyXHR[key] = (...args) => {
      // 拦截
      if (hooks[key] && (hooks[key].apply(proxyXHR._xhr, args) === false)) {
        return;
      }
      // abort需要优先上报，因为内部会触发xhrState
      if (key === 'abort') {
        this.setRecord(proxyXHR, key, args);
      }
  
      // 执行方法本体
      const res = proxyXHR._xhr[key].apply(proxyXHR._xhr, args);
      this.setRecord(proxyXHR, key, args, res);

      // 方法本体执行后的钩子
      execedHooks[key] && execedHooks[key].call(proxyXHR._xhr, args, res);

      return res;
    };
  }

  /**
   * 重写属性
   */
  overwriteAttributes(key, proxyXHR) {
    Object.defineProperty(proxyXHR, key, this.setProperyDescriptor(key, proxyXHR));
  }

  apiCallbackX(proxyXHR, record) {
    const hasCallback = proxyXHR._xhr.__hasCallback;
    if (!hasCallback && this.apiCallback) {
      proxyXHR._xhr.__hasCallback = true;
      this.apiCallback(record);
    }
   
  }

  /**
   * 对请求进行记录
   */
  setRecord (proxyXHR, key, args) {
    let record = proxyXHR._xhr.__record;
    const hasCallback = proxyXHR._xhr.__hasCallback;
    if (hasCallback) {
      return;
    }
    if (key === 'open') {
      const result = queryString.parseUrl(args[1]);
      // 记录请求的方法
      Object.assign(record, {
        method: args[0],
        url: result.url,
        params: result.query,
        pageUrl: encodeURIComponent(window.location.href),
      });
    } else if (key === 'send') {
      let body =  args[0];
        try {
          body = JSON.parse(body);
        } catch {}
      this.lastXhrSendStamp = Date.now();
      // 记录请求的参数
      Object.assign(record, {
        body,
        requestStamp: Date.now(), // 请求发送时间
      });
    }  else if (key === 'abort') {
      Object.assign(record, {
        canceled: true,
      });
      this.apiCallbackX(proxyXHR, record);
    } else if (key === 'onreadystatechange') {
      // 记录返回参数
      // readyState === 4 响应已完成；您可以获取并使用服务器的响应了
      if (proxyXHR.readyState === 4) {
        const responsHeadersString = proxyXHR.getAllResponseHeaders() || '';
        const responsHeaders = {};
        responsHeadersString.split('\r\n').filter(Boolean).forEach((_) => {
          const [k, v] = _.split(': ');
          responsHeaders[k] = v;
        });
        let responseData = proxyXHR.responseText || '{}';
        try {
          responseData = JSON.parse(responseData);
        } catch {}
        const responseStamp = Date.now();
        Object.assign(record, {
          responseData,
          responsHeaders,
          responseStamp, // 请求回来的时间
          costTime: responseStamp - record.requestStamp,
          status: proxyXHR.status,
        });
        this.apiCallbackX(proxyXHR, record);
      }
    } else if (key === 'setRequestHeader') {
      if (!record.requestHeaders) {
        record.requestHeaders = {};
      }
      record.requestHeaders[args[0]] = args[1];
    }
  };

  getXhrIdleTime = () => (Date.now() - this.lastXhrSendStamp);

  networkIdleCallback = (cb, idleTime = 3 * 1000) => {
    const distance = this.getXhrIdleTime();
    // 当前如果满足空闲时长，直接执行
    if (distance  >= idleTime) {
      cb();
    } else {
    // 如果不满足空闲时长，延迟 时长 差执行。例如空闲时间要求10s，当前看空闲6s，那么在4s后执行，如果4s后不满足，继续滞后。
      window.setTimeout(() => {
        if (this.getXhrIdleTime() >= idleTime) {
          cb();
        } else {
          this.networkIdleCallback(cb, idleTime)
        }
      }, idleTime - distance);
    }
  };

  /**
   * 设置属性的属性描述
   */
  setProperyDescriptor(key, proxyXHR) {
    let obj = Object.create(null);
    let _this = this;

    obj.set = function (val) {
      // 如果不是on打头的属性
      if (!key.startsWith('on')) {
        proxyXHR['__' + key] = val;
        return;
      }

      const fn = function (...args) {
        _this.setRecord(proxyXHR, key, args);
        val.apply(proxyXHR, args);
      };

      if (_this.hooks[key]) {

        this._xhr[key] = function (...args) {
          _this.hooks[key].apply(proxyXHR, args);
          fn(...args);
        };

        return;
      }
      this._xhr[key] = fn;
    };

    obj.get = function () {
      return proxyXHR['__' + key] || this._xhr[key];
    };

    return obj;
  }

  /**
   * 取消监听
   */
  unset() {
    window.XMLHttpRequest = this.XHR;
  }
}