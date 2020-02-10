/* global PROPS */
import { cycles as appCycles } from './app';
import Component from './component';
import { ON_SHOW, ON_HIDE, ON_PAGE_SCROLL, ON_SHARE_APP_MESSAGE, ON_REACH_BOTTOM, ON_PULL_DOWN_REFRESH, ON_TAB_ITEM_TAP, ON_TITLE_CLICK } from './cycles';
import { setComponentInstance, getComponentProps } from './updater';
// eslint-disable-next-line rax/no-implicit-dependencies
import { getComponentLifecycle, getComponentBaseConfig } from '@@ADAPTER@@';
import { createMiniAppHistory } from './history';
import { __updateRouterMap } from './router';
import getId from './getId';

const GET_DERIVED_STATE_FROM_PROPS = 'getDerivedStateFromProps';
let _appConfig;
let _pageProps = {};

/**
 * Reference relationship.
 * page/component instance          Rax instance
 *    instance    -------------->      *self
 *      *self     <--------------   _internal
 *      props     <----getter----     props
 *      data      <----getter----     state
 *    setData     <--------------    setState
 */
function getPageCycles(Klass) {
  let config = {
    onLoad(options) {
      // Ensure page has loaded
      const history = createMiniAppHistory();
      const { instanceId, props } = generateBaseOptions(this, Klass.defaultProps, {
        history,
        location: history.location
      }, _pageProps);
      this.instance = new Klass(props);
      this.instance.defaultProps = Klass.defaultProps;
      // Reverse sync from state to data.
      this.instance.instanceId = instanceId;
      this.instance._internal = this;
      Object.assign(this.instance.state, this.data);
      // Add route information for page.
      history.location.__updatePageOption(this.instance.instanceId, options);
      this.data = this.instance.state;

      if (this.instance.__ready) return;
      this.instance.__ready = true;
      this.instance._mountComponent();
    },
    onReady() {}, // noop
    onUnload() {
      this.instance._unmountComponent();
    },
    onShow() {
      if (this.instance.__mounted) this.instance._trigger(ON_SHOW);
    },
    onHide() {
      if (this.instance.__mounted) this.instance._trigger(ON_HIDE);
    }
  };
  [ON_PAGE_SCROLL, ON_SHARE_APP_MESSAGE, ON_REACH_BOTTOM, ON_PULL_DOWN_REFRESH, ON_TAB_ITEM_TAP, ON_TITLE_CLICK].forEach((hook) => {
    config[hook] = function(e) {
      return this.instance._trigger(hook, e);
    };
  });
  return config;
}

function getComponentCycles(Klass) {
  return getComponentLifecycle({
    mount: function() {
      const { instanceId, props } = generateBaseOptions(this, Klass.defaultProps);
      this.instance = new Klass(props);
      this.instance.defaultProps = Klass.defaultProps;
      this.instance.instanceId = instanceId;
      this.instance.type = Klass;
      this.instance._internal = this;
      Object.assign(this.instance.state, this.data);
      setComponentInstance(this.instance);

      if (GET_DERIVED_STATE_FROM_PROPS in Klass) {
        this.instance['__' + GET_DERIVED_STATE_FROM_PROPS] = Klass[GET_DERIVED_STATE_FROM_PROPS];
      }

      this.data = this.instance.state;
      this.instance._mountComponent();
    },
    unmount: function() {
      this.instance._unmountComponent();
    }
  });
}

function createProxyMethods(events) {
  const methods = {};
  if (Array.isArray(events)) {
    events.forEach(eventName => {
      methods[eventName] = function(...args) {
        // `this` point to page/component instance.
        const event = args[0];
        let context = this.instance; // Context default to Rax component instance.

        const dataset = event && event.currentTarget ? event.currentTarget.dataset : {};
        const datasetArgs = [];
        // Universal event args
        const datasetKeys = Object.keys(dataset);
        if (datasetKeys.length > 0) {
          datasetKeys.forEach((key) => {
            if ('argContext' === key || 'arg-context' === key) {
              context = dataset[key] === 'this' ? this.instance : dataset[key];
            } else if (isDatasetArg(key)) {
              // eg. arg0, arg1, arg-0, arg-1
              const index = DATASET_ARG_REG.exec(key)[1];
              datasetArgs[index] = dataset[key];
            }
          });
        } else {
          const formatName = formatEventName(eventName);
          Object.keys(this[PROPS]).forEach(key => {
            if (`data-${formatName}-arg-context` === key) {
              context = this[PROPS][key] === 'this' ? this.instance : this[PROPS][key];
            } else if (isDatasetKebabArg(key)) {
              // `data-arg-` length is 9.
              const len = `data-${formatName}-arg-`.length;
              datasetArgs[key.slice(len)] = this[PROPS][key];
            }
          });
        }
        // Concat args.
        args = datasetArgs.concat(args);
        if (this.instance._methods[eventName]) {
          return this.instance._methods[eventName].apply(context, args);
        } else {
          console.warn(`instance._methods['${eventName}'] not exists.`);
        }
      };
    });
  }
  return methods;
}

function createAnonymousClass(render) {
  return class extends Component {
    render(props) {
      return render.call(this, props);
    }
  };
}

/**
 * Bridge from Rax component class to MiniApp Component constructor.
 * @param {Class|Function} component Rax component definition.
 * @param {Object} options.
 * @return {Object} MiniApp constructor's config.
 */
function createConfig(component, options) {
  const Klass = isClassComponent(component)
    ? component
    : createAnonymousClass(component);

  const { events, isPage } = options;
  const cycles = isPage ? getPageCycles(Klass) : getComponentCycles(Klass);
  const config = {
    data: {},
    ...cycles,
    ...getComponentBaseConfig()
  };

  const proxiedMethods = createProxyMethods(events);
  if (isPage) {
    Object.assign(config, proxiedMethods);
  } else {
    config.methods = proxiedMethods;
  }

  return config;
}

/**
 * Bridge App definition.
 * @param appConfig
 * @param pageProps
 */
export function runApp(appConfig, pageProps = {}) {
  if (_appConfig) {
    throw new Error('runApp can only be called once.');
  }

  _appConfig = appConfig; // Store raw app config to parse router.
  _pageProps = pageProps; // Store global page props to inject to every page props
  __updateRouterMap(appConfig);

  const appOptions = {
    // Bridge app launch.
    onLaunch(launchOptions) {
      const launchQueue = appCycles.launch;
      if (Array.isArray(launchQueue) && launchQueue.length > 0) {
        let fn;
        while (fn = launchQueue.pop()) { // eslint-disable-line
          fn.call(this, launchOptions);
        }
      }
    },
  };

  // eslint-disable-next-line
  App(appOptions);
}

export function createPage(definition, options = {}) {
  options.isPage = true;
  return createConfig(definition, options);
}

export function createComponent(definition, options = {}) {
  return createConfig(definition, options);
}

function isClassComponent(Klass) {
  return Klass.prototype.__proto__ === Component.prototype;
}

const DATASET_KEBAB_ARG_REG = /data-\w+\d+-arg-\d+/;

function isDatasetKebabArg(str) {
  return DATASET_KEBAB_ARG_REG.test(str);
}

const DATASET_ARG_REG = /\w+-?[aA]rg?-?(\d+)/;

function isDatasetArg(str) {
  return DATASET_ARG_REG.test(str);
}

function formatEventName(name) {
  return name.replace('_', '');
}

function generateBaseOptions(internal, defaultProps, ...restProps) {
  const tagId = getId('tag', internal);
  const parentId = getId('parent', internal);
  const instanceId = tagId;

  const props = Object.assign({}, defaultProps, internal[PROPS], {
    __tagId: tagId,
    __parentId: parentId
  }, getComponentProps(instanceId), ...restProps);
  return {
    instanceId,
    props
  };
}
