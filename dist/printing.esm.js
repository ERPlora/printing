var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i4 = decorators.length - 1, decorator; i4 >= 0; i4--)
    if (decorator = decorators[i4])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// @lit-labs/ssr-dom-shim/lib/element-internals.js
var ElementInternalsShim = class ElementInternals {
  get shadowRoot() {
    return this.__host.__shadowRoot;
  }
  constructor(_host) {
    this.ariaActiveDescendantElement = null;
    this.ariaAtomic = "";
    this.ariaAutoComplete = "";
    this.ariaBrailleLabel = "";
    this.ariaBrailleRoleDescription = "";
    this.ariaBusy = "";
    this.ariaChecked = "";
    this.ariaColCount = "";
    this.ariaColIndex = "";
    this.ariaColIndexText = "";
    this.ariaColSpan = "";
    this.ariaControlsElements = null;
    this.ariaCurrent = "";
    this.ariaDescribedByElements = null;
    this.ariaDescription = "";
    this.ariaDetailsElements = null;
    this.ariaDisabled = "";
    this.ariaErrorMessageElements = null;
    this.ariaExpanded = "";
    this.ariaFlowToElements = null;
    this.ariaHasPopup = "";
    this.ariaHidden = "";
    this.ariaInvalid = "";
    this.ariaKeyShortcuts = "";
    this.ariaLabel = "";
    this.ariaLabelledByElements = null;
    this.ariaLevel = "";
    this.ariaLive = "";
    this.ariaModal = "";
    this.ariaMultiLine = "";
    this.ariaMultiSelectable = "";
    this.ariaOrientation = "";
    this.ariaOwnsElements = null;
    this.ariaPlaceholder = "";
    this.ariaPosInSet = "";
    this.ariaPressed = "";
    this.ariaReadOnly = "";
    this.ariaRelevant = "";
    this.ariaRequired = "";
    this.ariaRoleDescription = "";
    this.ariaRowCount = "";
    this.ariaRowIndex = "";
    this.ariaRowIndexText = "";
    this.ariaRowSpan = "";
    this.ariaSelected = "";
    this.ariaSetSize = "";
    this.ariaSort = "";
    this.ariaValueMax = "";
    this.ariaValueMin = "";
    this.ariaValueNow = "";
    this.ariaValueText = "";
    this.role = "";
    this.form = null;
    this.labels = [];
    this.states = /* @__PURE__ */ new Set();
    this.validationMessage = "";
    this.validity = {};
    this.willValidate = true;
    this.__host = _host;
  }
  checkValidity() {
    console.warn("`ElementInternals.checkValidity()` was called on the server.This method always returns true.");
    return true;
  }
  reportValidity() {
    return true;
  }
  setFormValue() {
  }
  setValidity() {
  }
};

// @lit-labs/ssr-dom-shim/lib/events.js
var __classPrivateFieldSet = function(receiver, state, value, kind, f3) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = function(receiver, state, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state.get(receiver);
};
var _Event_cancelable;
var _Event_bubbles;
var _Event_composed;
var _Event_defaultPrevented;
var _Event_timestamp;
var _Event_propagationStopped;
var _Event_type;
var _Event_target;
var _Event_isBeingDispatched;
var _a;
var _CustomEvent_detail;
var _b;
var NONE = 0;
var CAPTURING_PHASE = 1;
var AT_TARGET = 2;
var BUBBLING_PHASE = 3;
var enumerableProperty = { __proto__: null };
enumerableProperty.enumerable = true;
Object.freeze(enumerableProperty);
var EventShim = (_a = class Event {
  constructor(type, options = {}) {
    _Event_cancelable.set(this, false);
    _Event_bubbles.set(this, false);
    _Event_composed.set(this, false);
    _Event_defaultPrevented.set(this, false);
    _Event_timestamp.set(this, Date.now());
    _Event_propagationStopped.set(this, false);
    _Event_type.set(this, void 0);
    _Event_target.set(this, void 0);
    _Event_isBeingDispatched.set(this, void 0);
    this.NONE = NONE;
    this.CAPTURING_PHASE = CAPTURING_PHASE;
    this.AT_TARGET = AT_TARGET;
    this.BUBBLING_PHASE = BUBBLING_PHASE;
    if (arguments.length === 0)
      throw new Error(`The type argument must be specified`);
    if (typeof options !== "object" || !options) {
      throw new Error(`The "options" argument must be an object`);
    }
    const { bubbles, cancelable, composed } = options;
    __classPrivateFieldSet(this, _Event_cancelable, !!cancelable, "f");
    __classPrivateFieldSet(this, _Event_bubbles, !!bubbles, "f");
    __classPrivateFieldSet(this, _Event_composed, !!composed, "f");
    __classPrivateFieldSet(this, _Event_type, `${type}`, "f");
    __classPrivateFieldSet(this, _Event_target, null, "f");
    __classPrivateFieldSet(this, _Event_isBeingDispatched, false, "f");
  }
  initEvent(_type, _bubbles, _cancelable) {
    throw new Error("Method not implemented.");
  }
  stopImmediatePropagation() {
    this.stopPropagation();
  }
  preventDefault() {
    __classPrivateFieldSet(this, _Event_defaultPrevented, true, "f");
  }
  get target() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get currentTarget() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get srcElement() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get type() {
    return __classPrivateFieldGet(this, _Event_type, "f");
  }
  get cancelable() {
    return __classPrivateFieldGet(this, _Event_cancelable, "f");
  }
  get defaultPrevented() {
    return __classPrivateFieldGet(this, _Event_cancelable, "f") && __classPrivateFieldGet(this, _Event_defaultPrevented, "f");
  }
  get timeStamp() {
    return __classPrivateFieldGet(this, _Event_timestamp, "f");
  }
  composedPath() {
    return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? [__classPrivateFieldGet(this, _Event_target, "f")] : [];
  }
  get returnValue() {
    return !__classPrivateFieldGet(this, _Event_cancelable, "f") || !__classPrivateFieldGet(this, _Event_defaultPrevented, "f");
  }
  get bubbles() {
    return __classPrivateFieldGet(this, _Event_bubbles, "f");
  }
  get composed() {
    return __classPrivateFieldGet(this, _Event_composed, "f");
  }
  get eventPhase() {
    return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? _a.AT_TARGET : _a.NONE;
  }
  get cancelBubble() {
    return __classPrivateFieldGet(this, _Event_propagationStopped, "f");
  }
  set cancelBubble(value) {
    if (value) {
      __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
    }
  }
  stopPropagation() {
    __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
  }
  get isTrusted() {
    return false;
  }
}, _Event_cancelable = /* @__PURE__ */ new WeakMap(), _Event_bubbles = /* @__PURE__ */ new WeakMap(), _Event_composed = /* @__PURE__ */ new WeakMap(), _Event_defaultPrevented = /* @__PURE__ */ new WeakMap(), _Event_timestamp = /* @__PURE__ */ new WeakMap(), _Event_propagationStopped = /* @__PURE__ */ new WeakMap(), _Event_type = /* @__PURE__ */ new WeakMap(), _Event_target = /* @__PURE__ */ new WeakMap(), _Event_isBeingDispatched = /* @__PURE__ */ new WeakMap(), _a.NONE = NONE, _a.CAPTURING_PHASE = CAPTURING_PHASE, _a.AT_TARGET = AT_TARGET, _a.BUBBLING_PHASE = BUBBLING_PHASE, _a);
Object.defineProperties(EventShim.prototype, {
  initEvent: enumerableProperty,
  stopImmediatePropagation: enumerableProperty,
  preventDefault: enumerableProperty,
  target: enumerableProperty,
  currentTarget: enumerableProperty,
  srcElement: enumerableProperty,
  type: enumerableProperty,
  cancelable: enumerableProperty,
  defaultPrevented: enumerableProperty,
  timeStamp: enumerableProperty,
  composedPath: enumerableProperty,
  returnValue: enumerableProperty,
  bubbles: enumerableProperty,
  composed: enumerableProperty,
  eventPhase: enumerableProperty,
  cancelBubble: enumerableProperty,
  stopPropagation: enumerableProperty,
  isTrusted: enumerableProperty
});
var CustomEventShim = (_b = class CustomEvent extends EventShim {
  constructor(type, options = {}) {
    super(type, options);
    _CustomEvent_detail.set(this, void 0);
    __classPrivateFieldSet(this, _CustomEvent_detail, options?.detail ?? null, "f");
  }
  initCustomEvent(_type, _bubbles, _cancelable, _detail) {
    throw new Error("Method not implemented.");
  }
  get detail() {
    return __classPrivateFieldGet(this, _CustomEvent_detail, "f");
  }
}, _CustomEvent_detail = /* @__PURE__ */ new WeakMap(), _b);
Object.defineProperties(CustomEventShim.prototype, {
  detail: enumerableProperty
});
var EventShimWithRealType = EventShim;
var CustomEventShimWithRealType = CustomEventShim;

// @lit-labs/ssr-dom-shim/lib/css.js
var _a2;
var CSSRuleShim = (_a2 = class CSSRule {
  constructor() {
    this.STYLE_RULE = 1;
    this.CHARSET_RULE = 2;
    this.IMPORT_RULE = 3;
    this.MEDIA_RULE = 4;
    this.FONT_FACE_RULE = 5;
    this.PAGE_RULE = 6;
    this.NAMESPACE_RULE = 10;
    this.KEYFRAMES_RULE = 7;
    this.KEYFRAME_RULE = 8;
    this.SUPPORTS_RULE = 12;
    this.COUNTER_STYLE_RULE = 11;
    this.FONT_FEATURE_VALUES_RULE = 14;
    this.MARGIN_RULE = 9;
    this.__parentStyleSheet = null;
    this.cssText = "";
  }
  get parentRule() {
    return null;
  }
  get parentStyleSheet() {
    return this.__parentStyleSheet;
  }
  get type() {
    return 0;
  }
}, _a2.STYLE_RULE = 1, _a2.CHARSET_RULE = 2, _a2.IMPORT_RULE = 3, _a2.MEDIA_RULE = 4, _a2.FONT_FACE_RULE = 5, _a2.PAGE_RULE = 6, _a2.NAMESPACE_RULE = 10, _a2.KEYFRAMES_RULE = 7, _a2.KEYFRAME_RULE = 8, _a2.SUPPORTS_RULE = 12, _a2.COUNTER_STYLE_RULE = 11, _a2.FONT_FEATURE_VALUES_RULE = 14, _a2.MARGIN_RULE = 9, _a2);

// @lit-labs/ssr-dom-shim/index.js
globalThis.Event ??= EventShimWithRealType;
globalThis.CustomEvent ??= CustomEventShimWithRealType;
var constructionToken = Symbol();
var isCaptureEventListener = (options) => typeof options === "boolean" ? options : options?.capture ?? false;
var enumerableProperty2 = { __proto__: null };
enumerableProperty2.enumerable = true;
Object.freeze(enumerableProperty2);
var EventTarget = class {
  constructor() {
    this.__eventListeners = /* @__PURE__ */ new Map();
    this.__captureEventListeners = /* @__PURE__ */ new Map();
  }
  addEventListener(type, callback, options) {
    if (callback === void 0 || callback === null) {
      return;
    }
    const eventListenersMap = isCaptureEventListener(options) ? this.__captureEventListeners : this.__eventListeners;
    let eventListeners = eventListenersMap.get(type);
    if (eventListeners === void 0) {
      eventListeners = /* @__PURE__ */ new Map();
      eventListenersMap.set(type, eventListeners);
    } else if (eventListeners.has(callback)) {
      return;
    }
    const normalizedOptions = typeof options === "object" && options ? options : {};
    normalizedOptions.signal?.addEventListener("abort", () => this.removeEventListener(type, callback, options));
    eventListeners.set(callback, normalizedOptions ?? {});
  }
  removeEventListener(type, callback, options) {
    if (callback === void 0 || callback === null) {
      return;
    }
    const eventListenersMap = isCaptureEventListener(options) ? this.__captureEventListeners : this.__eventListeners;
    const eventListeners = eventListenersMap.get(type);
    if (eventListeners !== void 0) {
      eventListeners.delete(callback);
      if (!eventListeners.size) {
        eventListenersMap.delete(type);
      }
    }
  }
  dispatchEvent(event) {
    let composedPath = this.__resolveFullEventPath();
    if (!event.composed && this.__host) {
      composedPath = composedPath.slice(0, composedPath.indexOf(this.__host));
    }
    let stopPropagation = false;
    let stopImmediatePropagation = false;
    let eventPhase = EventShimWithRealType.NONE;
    let target = null;
    let tmpTarget = null;
    let currentTarget = null;
    const originalStopPropagation = event.stopPropagation;
    const originalStopImmediatePropagation = event.stopImmediatePropagation;
    Object.defineProperties(event, {
      target: {
        get() {
          return target ?? tmpTarget;
        },
        ...enumerableProperty2
      },
      srcElement: {
        get() {
          return event.target;
        },
        ...enumerableProperty2
      },
      currentTarget: {
        get() {
          return currentTarget;
        },
        ...enumerableProperty2
      },
      eventPhase: {
        get() {
          return eventPhase;
        },
        ...enumerableProperty2
      },
      composedPath: {
        value: () => composedPath,
        ...enumerableProperty2
      },
      stopPropagation: {
        value: () => {
          stopPropagation = true;
          originalStopPropagation.call(event);
        },
        ...enumerableProperty2
      },
      stopImmediatePropagation: {
        value: () => {
          stopImmediatePropagation = true;
          originalStopImmediatePropagation.call(event);
        },
        ...enumerableProperty2
      }
    });
    const invokeEventListener = (listener, options, eventListenerMap) => {
      if (typeof listener === "function") {
        listener(event);
      } else if (typeof listener?.handleEvent === "function") {
        listener.handleEvent(event);
      }
      if (options.once) {
        eventListenerMap.delete(listener);
      }
    };
    const finishDispatch = () => {
      currentTarget = null;
      eventPhase = EventShimWithRealType.NONE;
      return !event.defaultPrevented;
    };
    const captureEventPath = composedPath.slice().reverse();
    target = !this.__host || !event.composed ? this : null;
    const retarget = (eventTargets) => {
      tmpTarget = this;
      while (tmpTarget.__host && eventTargets.includes(tmpTarget.__host)) {
        tmpTarget = tmpTarget.__host;
      }
    };
    for (const eventTarget of captureEventPath) {
      if (!target && (!tmpTarget || tmpTarget === eventTarget.__host)) {
        retarget(captureEventPath.slice(captureEventPath.indexOf(eventTarget)));
      }
      currentTarget = eventTarget;
      eventPhase = eventTarget === event.target ? EventShimWithRealType.AT_TARGET : EventShimWithRealType.CAPTURING_PHASE;
      const captureEventListeners = eventTarget.__captureEventListeners.get(event.type);
      if (captureEventListeners) {
        for (const [listener, options] of captureEventListeners) {
          invokeEventListener(listener, options, captureEventListeners);
          if (stopImmediatePropagation) {
            return finishDispatch();
          }
        }
      }
      if (stopPropagation) {
        return finishDispatch();
      }
    }
    const bubbleEventPath = event.bubbles ? composedPath : [this];
    tmpTarget = null;
    for (const eventTarget of bubbleEventPath) {
      if (!target && (!tmpTarget || eventTarget === tmpTarget.__host)) {
        retarget(bubbleEventPath.slice(0, bubbleEventPath.indexOf(eventTarget) + 1));
      }
      currentTarget = eventTarget;
      eventPhase = eventTarget === event.target ? EventShimWithRealType.AT_TARGET : EventShimWithRealType.BUBBLING_PHASE;
      const eventListeners = eventTarget.__eventListeners.get(event.type);
      if (eventListeners) {
        for (const [listener, options] of eventListeners) {
          invokeEventListener(listener, options, eventListeners);
          if (stopImmediatePropagation) {
            return finishDispatch();
          }
        }
      }
      if (stopPropagation) {
        return finishDispatch();
      }
    }
    return finishDispatch();
  }
  __resolveFullEventPath() {
    if (this.__eventPathCache) {
      return this.__eventPathCache;
    } else if (!this.__eventTargetParent) {
      return this.__eventPathCache = [this, documentShim, windowShim];
    } else {
      return this.__eventPathCache = [
        this,
        ...this.__eventTargetParent.__resolveFullEventPath()
      ];
    }
  }
};
var attributes = /* @__PURE__ */ new WeakMap();
var attributesForElement = (element) => {
  let attrs = attributes.get(element);
  if (attrs === void 0) {
    attributes.set(element, attrs = /* @__PURE__ */ new Map());
  }
  return attrs;
};
var NodeShim = class Node extends EventTarget {
  getRootNode(options) {
    if (options?.composed) {
      return document2;
    }
    const host = this.__host;
    return host?.__shadowRoot ?? document2;
  }
};
var DocumentShim = class Document2 extends NodeShim {
  get adoptedStyleSheets() {
    return [];
  }
  createTreeWalker() {
    return {};
  }
  createTextNode() {
    return {};
  }
  createElement() {
    return {};
  }
};
var documentShim = new DocumentShim();
var document2 = documentShim;
var WindowShim = class Window extends NodeShim {
  constructor(token) {
    super();
    if (token !== constructionToken) {
      throw new TypeError("Illegal constructor");
    }
    Object.assign(this, globalThis, {
      CustomElementRegistry,
      customElements: customElements2,
      document: document2,
      Document: DocumentShim,
      Element: ElementShim,
      EventTarget,
      HTMLElement: HTMLElementShim,
      Node: NodeShim,
      ShadowRoot: ShadowRootShim,
      window: this,
      Window: WindowShim
    });
  }
};
var ElementShim = class Element extends NodeShim {
  constructor() {
    super(...arguments);
    this.__shadowRootMode = null;
    this.__shadowRoot = null;
    this.__internals = null;
  }
  get attributes() {
    return Array.from(attributesForElement(this)).map(([name, value]) => ({
      name,
      value
    }));
  }
  get shadowRoot() {
    if (this.__shadowRootMode === "closed") {
      return null;
    }
    return this.__shadowRoot;
  }
  get localName() {
    return this.constructor.__localName;
  }
  get tagName() {
    return this.localName?.toUpperCase();
  }
  setAttribute(name, value) {
    attributesForElement(this).set(name, String(value));
  }
  removeAttribute(name) {
    attributesForElement(this).delete(name);
  }
  toggleAttribute(name, force) {
    if (this.hasAttribute(name)) {
      if (force === void 0 || !force) {
        this.removeAttribute(name);
        return false;
      }
    } else {
      if (force === void 0 || force) {
        this.setAttribute(name, "");
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
  hasAttribute(name) {
    return attributesForElement(this).has(name);
  }
  attachShadow(init) {
    this.__shadowRootMode = init.mode;
    const shadowRoot = new ShadowRootShim(constructionToken, init);
    shadowRoot.__eventTargetParent = this;
    shadowRoot.__host = this;
    return this.__shadowRoot = shadowRoot;
  }
  attachInternals() {
    if (this.__internals !== null) {
      throw new Error(`Failed to execute 'attachInternals' on 'HTMLElement': ElementInternals for the specified element was already attached.`);
    }
    const internals = new ElementInternalsShim(this);
    this.__internals = internals;
    return internals;
  }
  getAttribute(name) {
    const value = attributesForElement(this).get(name);
    return value ?? null;
  }
};
var HTMLElementShim = class HTMLElement extends ElementShim {
};
var HTMLElementShimWithRealType = HTMLElementShim;
var ShadowRootShim = class ShadowRoot extends NodeShim {
  get host() {
    return this.__host;
  }
  constructor(constructionToken2, init) {
    super();
    if (constructionToken2 !== constructionToken2) {
      throw new TypeError("Illegal constructor");
    }
    this.mode = init.mode;
  }
};
globalThis.litServerRoot ??= Object.defineProperty(new HTMLElementShimWithRealType(), "localName", {
  // Patch localName (and tagName) to return a unique name.
  get() {
    return "lit-server-root";
  }
});
function promiseWithResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
var CustomElementRegistry = class {
  constructor() {
    this.__definitions = /* @__PURE__ */ new Map();
    this.__reverseDefinitions = /* @__PURE__ */ new Map();
    this.__pendingWhenDefineds = /* @__PURE__ */ new Map();
  }
  define(name, ctor) {
    if (this.__definitions.has(name)) {
      if (true) {
        console.warn(`'CustomElementRegistry' already has "${name}" defined. This may have been caused by live reload or hot module replacement in which case it can be safely ignored.
Make sure to test your application with a production build as repeat registrations will throw in production.`);
      } else {
        throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': the name "${name}" has already been used with this registry`);
      }
    }
    if (this.__reverseDefinitions.has(ctor)) {
      throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': the constructor has already been used with this registry for the tag name ${this.__reverseDefinitions.get(ctor)}`);
    }
    ctor.__localName = name;
    this.__definitions.set(name, {
      ctor,
      // Note it's important we read `observedAttributes` in case it is a getter
      // with side-effects, as is the case in Lit, where it triggers class
      // finalization.
      //
      // TODO(aomarks) To be spec compliant, we should also capture the
      // registration-time lifecycle methods like `connectedCallback`. For them
      // to be actually accessible to e.g. the Lit SSR element renderer, though,
      // we'd need to introduce a new API for accessing them (since `get` only
      // returns the constructor).
      observedAttributes: ctor.observedAttributes ?? []
    });
    this.__reverseDefinitions.set(ctor, name);
    this.__pendingWhenDefineds.get(name)?.resolve(ctor);
    this.__pendingWhenDefineds.delete(name);
  }
  get(name) {
    const definition = this.__definitions.get(name);
    return definition?.ctor;
  }
  getName(ctor) {
    return this.__reverseDefinitions.get(ctor) ?? null;
  }
  initialize(_root) {
    throw new Error(`customElements.initialize is not currently supported in SSR. Please file a bug if you need it.`);
  }
  upgrade(_element) {
    throw new Error(`customElements.upgrade is not currently supported in SSR. Please file a bug if you need it.`);
  }
  async whenDefined(name) {
    const definition = this.__definitions.get(name);
    if (definition) {
      return definition.ctor;
    }
    let withResolvers = this.__pendingWhenDefineds.get(name);
    if (!withResolvers) {
      withResolvers = promiseWithResolvers();
      this.__pendingWhenDefineds.set(name, withResolvers);
    }
    return withResolvers.promise;
  }
};
var CustomElementRegistryShimWithRealType = CustomElementRegistry;
var customElements2 = new CustomElementRegistryShimWithRealType();
var windowShim = new WindowShim(constructionToken);

// @lit/reactive-element/node/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t3, e4, o6) {
    if (this._$cssResult$ = true, o6 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t3, this.t = e4;
  }
  get styleSheet() {
    let t3 = this.o;
    const s4 = this.t;
    if (e && void 0 === t3) {
      const e4 = void 0 !== s4 && 1 === s4.length;
      e4 && (t3 = o.get(s4)), void 0 === t3 && ((this.o = t3 = new CSSStyleSheet()).replaceSync(this.cssText), e4 && o.set(s4, t3));
    }
    return t3;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t3) => new n("string" == typeof t3 ? t3 : t3 + "", void 0, s);
var i = (t3, ...e4) => {
  const o6 = 1 === t3.length ? t3[0] : e4.reduce((e5, s4, o7) => e5 + ((t4) => {
    if (true === t4._$cssResult$) return t4.cssText;
    if ("number" == typeof t4) return t4;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t4 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s4) + t3[o7 + 1], t3[0]);
  return new n(o6, t3, s);
};
var S = (s4, o6) => {
  if (e) s4.adoptedStyleSheets = o6.map((t3) => t3 instanceof CSSStyleSheet ? t3 : t3.styleSheet);
  else for (const e4 of o6) {
    const o7 = document.createElement("style"), n5 = t.litNonce;
    void 0 !== n5 && o7.setAttribute("nonce", n5), o7.textContent = e4.cssText, s4.appendChild(o7);
  }
};
var c = e || void 0 === t.CSSStyleSheet ? (t3) => t3 : (t3) => t3 instanceof CSSStyleSheet ? ((t4) => {
  let e4 = "";
  for (const s4 of t4.cssRules) e4 += s4.cssText;
  return r(e4);
})(t3) : t3;

// @lit/reactive-element/node/reactive-element.js
var { is: h, defineProperty: r2, getOwnPropertyDescriptor: o2, getOwnPropertyNames: n2, getOwnPropertySymbols: a, getPrototypeOf: c2 } = Object;
var l = globalThis;
l.customElements ??= customElements2;
var p = l.trustedTypes;
var d = p ? p.emptyScript : "";
var u = l.reactiveElementPolyfillSupport;
var f = (t3, s4) => t3;
var b = { toAttribute(t3, s4) {
  switch (s4) {
    case Boolean:
      t3 = t3 ? d : null;
      break;
    case Object:
    case Array:
      t3 = null == t3 ? t3 : JSON.stringify(t3);
  }
  return t3;
}, fromAttribute(t3, s4) {
  let i4 = t3;
  switch (s4) {
    case Boolean:
      i4 = null !== t3;
      break;
    case Number:
      i4 = null === t3 ? null : Number(t3);
      break;
    case Object:
    case Array:
      try {
        i4 = JSON.parse(t3);
      } catch (t4) {
        i4 = null;
      }
  }
  return i4;
} };
var m = (t3, s4) => !h(t3, s4);
var y = { attribute: true, type: String, converter: b, reflect: false, useDefault: false, hasChanged: m };
Symbol.metadata ??= Symbol("metadata"), l.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var g = class extends (globalThis.HTMLElement ?? HTMLElementShimWithRealType) {
  static addInitializer(t3) {
    this._$Ei(), (this.l ??= []).push(t3);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t3, s4 = y) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t3) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t3, s4), !s4.noAccessor) {
      const i4 = Symbol(), e4 = this.getPropertyDescriptor(t3, i4, s4);
      void 0 !== e4 && r2(this.prototype, t3, e4);
    }
  }
  static getPropertyDescriptor(t3, s4, i4) {
    const { get: e4, set: h3 } = o2(this.prototype, t3) ?? { get() {
      return this[s4];
    }, set(t4) {
      this[s4] = t4;
    } };
    return { get: e4, set(s5) {
      const r6 = e4?.call(this);
      h3?.call(this, s5), this.requestUpdate(t3, r6, i4);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t3) {
    return this.elementProperties.get(t3) ?? y;
  }
  static _$Ei() {
    if (this.hasOwnProperty(f("elementProperties"))) return;
    const t3 = c2(this);
    t3.finalize(), void 0 !== t3.l && (this.l = [...t3.l]), this.elementProperties = new Map(t3.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(f("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(f("properties"))) {
      const t4 = this.properties, s4 = [...n2(t4), ...a(t4)];
      for (const i4 of s4) this.createProperty(i4, t4[i4]);
    }
    const t3 = this[Symbol.metadata];
    if (null !== t3) {
      const s4 = litPropertyMetadata.get(t3);
      if (void 0 !== s4) for (const [t4, i4] of s4) this.elementProperties.set(t4, i4);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t4, s4] of this.elementProperties) {
      const i4 = this._$Eu(t4, s4);
      void 0 !== i4 && this._$Eh.set(i4, t4);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t3) {
    const s4 = [];
    if (Array.isArray(t3)) {
      const e4 = new Set(t3.flat(1 / 0).reverse());
      for (const t4 of e4) s4.unshift(c(t4));
    } else void 0 !== t3 && s4.push(c(t3));
    return s4;
  }
  static _$Eu(t3, s4) {
    const i4 = s4.attribute;
    return false === i4 ? void 0 : "string" == typeof i4 ? i4 : "string" == typeof t3 ? t3.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t3) => this.enableUpdating = t3), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t3) => t3(this));
  }
  addController(t3) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t3), void 0 !== this.renderRoot && this.isConnected && t3.hostConnected?.();
  }
  removeController(t3) {
    this._$EO?.delete(t3);
  }
  _$E_() {
    const t3 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i4 of s4.keys()) this.hasOwnProperty(i4) && (t3.set(i4, this[i4]), delete this[i4]);
    t3.size > 0 && (this._$Ep = t3);
  }
  createRenderRoot() {
    const t3 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t3, this.constructor.elementStyles), t3;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t3) => t3.hostConnected?.());
  }
  enableUpdating(t3) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t3) => t3.hostDisconnected?.());
  }
  attributeChangedCallback(t3, s4, i4) {
    this._$AK(t3, i4);
  }
  _$ET(t3, s4) {
    const i4 = this.constructor.elementProperties.get(t3), e4 = this.constructor._$Eu(t3, i4);
    if (void 0 !== e4 && true === i4.reflect) {
      const h3 = (void 0 !== i4.converter?.toAttribute ? i4.converter : b).toAttribute(s4, i4.type);
      this._$Em = t3, null == h3 ? this.removeAttribute(e4) : this.setAttribute(e4, h3), this._$Em = null;
    }
  }
  _$AK(t3, s4) {
    const i4 = this.constructor, e4 = i4._$Eh.get(t3);
    if (void 0 !== e4 && this._$Em !== e4) {
      const t4 = i4.getPropertyOptions(e4), h3 = "function" == typeof t4.converter ? { fromAttribute: t4.converter } : void 0 !== t4.converter?.fromAttribute ? t4.converter : b;
      this._$Em = e4;
      const r6 = h3.fromAttribute(s4, t4.type);
      this[e4] = r6 ?? this._$Ej?.get(e4) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t3, s4, i4, e4 = false, h3) {
    if (void 0 !== t3) {
      const r6 = this.constructor;
      if (false === e4 && (h3 = this[t3]), i4 ??= r6.getPropertyOptions(t3), !((i4.hasChanged ?? m)(h3, s4) || i4.useDefault && i4.reflect && h3 === this._$Ej?.get(t3) && !this.hasAttribute(r6._$Eu(t3, i4)))) return;
      this.C(t3, s4, i4);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t3, s4, { useDefault: i4, reflect: e4, wrapped: h3 }, r6) {
    i4 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t3) && (this._$Ej.set(t3, r6 ?? s4 ?? this[t3]), true !== h3 || void 0 !== r6) || (this._$AL.has(t3) || (this.hasUpdated || i4 || (s4 = void 0), this._$AL.set(t3, s4)), true === e4 && this._$Em !== t3 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t3));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t4) {
      Promise.reject(t4);
    }
    const t3 = this.scheduleUpdate();
    return null != t3 && await t3, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t5, s5] of this._$Ep) this[t5] = s5;
        this._$Ep = void 0;
      }
      const t4 = this.constructor.elementProperties;
      if (t4.size > 0) for (const [s5, i4] of t4) {
        const { wrapped: t5 } = i4, e4 = this[s5];
        true !== t5 || this._$AL.has(s5) || void 0 === e4 || this.C(s5, void 0, i4, e4);
      }
    }
    let t3 = false;
    const s4 = this._$AL;
    try {
      t3 = this.shouldUpdate(s4), t3 ? (this.willUpdate(s4), this._$EO?.forEach((t4) => t4.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t3 = false, this._$EM(), s5;
    }
    t3 && this._$AE(s4);
  }
  willUpdate(t3) {
  }
  _$AE(t3) {
    this._$EO?.forEach((t4) => t4.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t3)), this.updated(t3);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t3) {
    return true;
  }
  update(t3) {
    this._$Eq &&= this._$Eq.forEach((t4) => this._$ET(t4, this[t4])), this._$EM();
  }
  updated(t3) {
  }
  firstUpdated(t3) {
  }
};
g.elementStyles = [], g.shadowRootOptions = { mode: "open" }, g[f("elementProperties")] = /* @__PURE__ */ new Map(), g[f("finalized")] = /* @__PURE__ */ new Map(), u?.({ ReactiveElement: g }), (l.reactiveElementVersions ??= []).push("2.1.2");

// lit-html/lit-html.js
var t2 = globalThis;
var i2 = (t3) => t3;
var s2 = t2.trustedTypes;
var e2 = s2 ? s2.createPolicy("lit-html", { createHTML: (t3) => t3 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t3) => null === t3 || "object" != typeof t3 && "function" != typeof t3;
var u2 = Array.isArray;
var d2 = (t3) => u2(t3) || "function" == typeof t3?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m2 = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g2 = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t3) => (i4, ...s4) => ({ _$litType$: t3, strings: i4, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t3, i4) {
  if (!u2(t3) || !t3.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e2 ? e2.createHTML(i4) : i4;
}
var N = (t3, i4) => {
  const s4 = t3.length - 1, e4 = [];
  let n5, l3 = 2 === i4 ? "<svg>" : 3 === i4 ? "<math>" : "", c4 = v;
  for (let i5 = 0; i5 < s4; i5++) {
    const s5 = t3[i5];
    let a3, u3, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u3 = c4.exec(s5), null !== u3); ) f3 = c4.lastIndex, c4 === v ? "!--" === u3[1] ? c4 = _ : void 0 !== u3[1] ? c4 = m2 : void 0 !== u3[2] ? (y2.test(u3[2]) && (n5 = RegExp("</" + u3[2], "g")), c4 = p2) : void 0 !== u3[3] && (c4 = p2) : c4 === p2 ? ">" === u3[0] ? (c4 = n5 ?? v, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? p2 : '"' === u3[3] ? $ : g2) : c4 === $ || c4 === g2 ? c4 = p2 : c4 === _ || c4 === m2 ? c4 = v : (c4 = p2, n5 = void 0);
    const x2 = c4 === p2 && t3[i5 + 1].startsWith("/>") ? " " : "";
    l3 += c4 === v ? s5 + r3 : d3 >= 0 ? (e4.push(a3), s5.slice(0, d3) + h2 + s5.slice(d3) + o3 + x2) : s5 + o3 + (-2 === d3 ? i5 : x2);
  }
  return [V(t3, l3 + (t3[s4] || "<?>") + (2 === i4 ? "</svg>" : 3 === i4 ? "</math>" : "")), e4];
};
var S2 = class _S {
  constructor({ strings: t3, _$litType$: i4 }, e4) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u3 = t3.length - 1, d3 = this.parts, [f3, v2] = N(t3, i4);
    if (this.el = _S.createElement(f3, e4), P.currentNode = this.el.content, 2 === i4 || 3 === i4) {
      const t4 = this.el.content.firstChild;
      t4.replaceWith(...t4.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u3; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t4 of r6.getAttributeNames()) if (t4.endsWith(h2)) {
          const i5 = v2[a3++], s4 = r6.getAttribute(t4).split(o3), e5 = /([.?@])?(.*)/.exec(i5);
          d3.push({ type: 1, index: l3, name: e5[2], strings: s4, ctor: "." === e5[1] ? I : "?" === e5[1] ? L : "@" === e5[1] ? z : H }), r6.removeAttribute(t4);
        } else t4.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t4));
        if (y2.test(r6.tagName)) {
          const t4 = r6.textContent.split(o3), i5 = t4.length - 1;
          if (i5 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i5; s4++) r6.append(t4[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t4[i5], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t4 = -1;
        for (; -1 !== (t4 = r6.data.indexOf(o3, t4 + 1)); ) d3.push({ type: 7, index: l3 }), t4 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t3, i4) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t3, s4;
  }
};
function M(t3, i4, s4 = t3, e4) {
  if (i4 === E) return i4;
  let h3 = void 0 !== e4 ? s4._$Co?.[e4] : s4._$Cl;
  const o6 = a2(i4) ? void 0 : i4._$litDirective$;
  return h3?.constructor !== o6 && (h3?._$AO?.(false), void 0 === o6 ? h3 = void 0 : (h3 = new o6(t3), h3._$AT(t3, s4, e4)), void 0 !== e4 ? (s4._$Co ??= [])[e4] = h3 : s4._$Cl = h3), void 0 !== h3 && (i4 = M(t3, h3._$AS(t3, i4.values), h3, e4)), i4;
}
var R = class {
  constructor(t3, i4) {
    this._$AV = [], this._$AN = void 0, this._$AD = t3, this._$AM = i4;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t3) {
    const { el: { content: i4 }, parts: s4 } = this._$AD, e4 = (t3?.creationScope ?? l2).importNode(i4, true);
    P.currentNode = e4;
    let h3 = P.nextNode(), o6 = 0, n5 = 0, r6 = s4[0];
    for (; void 0 !== r6; ) {
      if (o6 === r6.index) {
        let i5;
        2 === r6.type ? i5 = new k(h3, h3.nextSibling, this, t3) : 1 === r6.type ? i5 = new r6.ctor(h3, r6.name, r6.strings, this, t3) : 6 === r6.type && (i5 = new Z(h3, this, t3)), this._$AV.push(i5), r6 = s4[++n5];
      }
      o6 !== r6?.index && (h3 = P.nextNode(), o6++);
    }
    return P.currentNode = l2, e4;
  }
  p(t3) {
    let i4 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t3, s4, i4), i4 += s4.strings.length - 2) : s4._$AI(t3[i4])), i4++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t3, i4, s4, e4) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t3, this._$AB = i4, this._$AM = s4, this.options = e4, this._$Cv = e4?.isConnected ?? true;
  }
  get parentNode() {
    let t3 = this._$AA.parentNode;
    const i4 = this._$AM;
    return void 0 !== i4 && 11 === t3?.nodeType && (t3 = i4.parentNode), t3;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t3, i4 = this) {
    t3 = M(this, t3, i4), a2(t3) ? t3 === A || null == t3 || "" === t3 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t3 !== this._$AH && t3 !== E && this._(t3) : void 0 !== t3._$litType$ ? this.$(t3) : void 0 !== t3.nodeType ? this.T(t3) : d2(t3) ? this.k(t3) : this._(t3);
  }
  O(t3) {
    return this._$AA.parentNode.insertBefore(t3, this._$AB);
  }
  T(t3) {
    this._$AH !== t3 && (this._$AR(), this._$AH = this.O(t3));
  }
  _(t3) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t3 : this.T(l2.createTextNode(t3)), this._$AH = t3;
  }
  $(t3) {
    const { values: i4, _$litType$: s4 } = t3, e4 = "number" == typeof s4 ? this._$AC(t3) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e4) this._$AH.p(i4);
    else {
      const t4 = new R(e4, this), s5 = t4.u(this.options);
      t4.p(i4), this.T(s5), this._$AH = t4;
    }
  }
  _$AC(t3) {
    let i4 = C.get(t3.strings);
    return void 0 === i4 && C.set(t3.strings, i4 = new S2(t3)), i4;
  }
  k(t3) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i4 = this._$AH;
    let s4, e4 = 0;
    for (const h3 of t3) e4 === i4.length ? i4.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i4[e4], s4._$AI(h3), e4++;
    e4 < i4.length && (this._$AR(s4 && s4._$AB.nextSibling, e4), i4.length = e4);
  }
  _$AR(t3 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t3 !== this._$AB; ) {
      const s5 = i2(t3).nextSibling;
      i2(t3).remove(), t3 = s5;
    }
  }
  setConnected(t3) {
    void 0 === this._$AM && (this._$Cv = t3, this._$AP?.(t3));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t3, i4, s4, e4, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t3, this.name = i4, this._$AM = e4, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t3, i4 = this, s4, e4) {
    const h3 = this.strings;
    let o6 = false;
    if (void 0 === h3) t3 = M(this, t3, i4, 0), o6 = !a2(t3) || t3 !== this._$AH && t3 !== E, o6 && (this._$AH = t3);
    else {
      const e5 = t3;
      let n5, r6;
      for (t3 = h3[0], n5 = 0; n5 < h3.length - 1; n5++) r6 = M(this, e5[s4 + n5], i4, n5), r6 === E && (r6 = this._$AH[n5]), o6 ||= !a2(r6) || r6 !== this._$AH[n5], r6 === A ? t3 = A : t3 !== A && (t3 += (r6 ?? "") + h3[n5 + 1]), this._$AH[n5] = r6;
    }
    o6 && !e4 && this.j(t3);
  }
  j(t3) {
    t3 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t3 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t3) {
    this.element[this.name] = t3 === A ? void 0 : t3;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t3) {
    this.element.toggleAttribute(this.name, !!t3 && t3 !== A);
  }
};
var z = class extends H {
  constructor(t3, i4, s4, e4, h3) {
    super(t3, i4, s4, e4, h3), this.type = 5;
  }
  _$AI(t3, i4 = this) {
    if ((t3 = M(this, t3, i4, 0) ?? A) === E) return;
    const s4 = this._$AH, e4 = t3 === A && s4 !== A || t3.capture !== s4.capture || t3.once !== s4.once || t3.passive !== s4.passive, h3 = t3 !== A && (s4 === A || e4);
    e4 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t3), this._$AH = t3;
  }
  handleEvent(t3) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t3) : this._$AH.handleEvent(t3);
  }
};
var Z = class {
  constructor(t3, i4, s4) {
    this.element = t3, this.type = 6, this._$AN = void 0, this._$AM = i4, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t3) {
    M(this, t3);
  }
};
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ??= []).push("3.3.3");
var D = (t3, i4, s4) => {
  const e4 = s4?.renderBefore ?? i4;
  let h3 = e4._$litPart$;
  if (void 0 === h3) {
    const t4 = s4?.renderBefore ?? null;
    e4._$litPart$ = h3 = new k(i4.insertBefore(c3(), t4), t4, void 0, s4 ?? {});
  }
  return h3._$AI(t3), h3;
};

// lit-element/lit-element.js
var s3 = globalThis;
var i3 = class extends g {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t3 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t3.firstChild, t3;
  }
  update(t3) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t3), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i3._$litElement$ = true, i3["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i3 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i3 });
(s3.litElementVersions ??= []).push("4.2.2");

// @lit/reactive-element/node/decorators/property.js
var o5 = { attribute: true, type: String, converter: b, reflect: false, hasChanged: m };
var r4 = (t3 = o5, e4, r6) => {
  const { kind: n5, metadata: i4 } = r6;
  let s4 = globalThis.litPropertyMetadata.get(i4);
  if (void 0 === s4 && globalThis.litPropertyMetadata.set(i4, s4 = /* @__PURE__ */ new Map()), "setter" === n5 && ((t3 = Object.create(t3)).wrapped = true), s4.set(r6.name, t3), "accessor" === n5) {
    const { name: o6 } = r6;
    return { set(r7) {
      const n6 = e4.get.call(this);
      e4.set.call(this, r7), this.requestUpdate(o6, n6, t3, true, r7);
    }, init(e5) {
      return void 0 !== e5 && this.C(o6, void 0, t3, e5), e5;
    } };
  }
  if ("setter" === n5) {
    const { name: o6 } = r6;
    return function(r7) {
      const n6 = this[o6];
      e4.call(this, r7), this.requestUpdate(o6, n6, t3, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n5);
};
function n4(t3) {
  return (e4, o6) => "object" == typeof o6 ? r4(t3, e4, o6) : ((t4, e5, o7) => {
    const r6 = e5.hasOwnProperty(o7);
    return e5.constructor.createProperty(o7, t4), r6 ? Object.getOwnPropertyDescriptor(e5, o7) : void 0;
  })(t3, e4, o6);
}

// @lit/reactive-element/node/decorators/state.js
function r5(r6) {
  return n4({ ...r6, state: true, attribute: false });
}

// @erplora/outfitkit/dist/define.js
function define(tag, ctor) {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
}

// locales/es.json
var es_default = {
  name: "Impresi\xF3n",
  description: "Impresi\xF3n de tiques, comandas de cocina y etiquetas desde el dispositivo que tengas conectado.",
  navigation: {
    printing: {
      label: "Impresoras"
    }
  },
  setup: {
    title: "Tu impresora",
    description: "Pon los datos de tu negocio en el tique y asigna la impresora que lo imprime."
  },
  ui: {
    printersTitle: "Impresoras",
    printersIntro: "Configura la impresi\xF3n de tickets y las impresoras encontradas en esta red.",
    ticketSettings: "Ajustes del ticket",
    receiptHeader: "Cabecera del recibo",
    receiptHeaderPlaceholder: "Mi negocio \xB7 NIF \xB7 direcci\xF3n",
    receiptFooter: "Pie del recibo",
    receiptFooterPlaceholder: "\xA1Gracias por su compra!",
    paperWidth: "Ancho de papel",
    autoPrintOnSale: "Imprimir ticket al cobrar",
    openDrawerOnSale: "Abrir caj\xF3n al cobrar",
    saving: "Guardando\u2026",
    saveSettings: "Guardar ajustes",
    saved: "\u2713 Guardado",
    networkPrinters: "Impresoras en la red",
    scanning: "Escaneando\u2026",
    rescan: "Re-escanear",
    printerReady: "Este dispositivo puede llegar a las impresoras",
    hardwareUnavailable: "Desde el navegador, este dispositivo no puede llegar a las impresoras. Instala la app de ERPlora en el dispositivo conectado a la impresora y abre tu negocio desde ah\xED.",
    noPrintersFound: "No se encontraron impresoras de red (puerto 9100) en esta subred.",
    rolePlaceholder: "Rol",
    test: "Probar",
    roleReceipt: "Recibo",
    roleKitchen: "Cocina",
    roleBar: "Barra",
    roleLabel: "Etiqueta",
    errLoadSettings: "No se pudieron cargar los ajustes",
    errSaveSettings: "No se pudo guardar",
    errScan: "Error al escanear",
    warnA4Printer: "Esta impresora parece de oficina (A4) y no entiende tickets. Los tiques y comandas necesitan una impresora t\xE9rmica.",
    errAssignRole: "No se pudo asignar el rol",
    errTestPrint: "Fall\xF3 la impresi\xF3n de prueba",
    loading: "Cargando\u2026",
    queueTitle: "Cola de impresi\xF3n",
    queueRefresh: "Refrescar",
    queueRefreshing: "Refrescando\u2026",
    queueAlertWaiting: "{waiting} trabajo(s) de impresi\xF3n de {role} llevan {age} esperando.",
    queueNoDevice: "Ning\xFAn dispositivo de este rol est\xE1 conectado: instala la app de ERPlora en el dispositivo conectado a la impresora y abre tu negocio desde ah\xED.",
    queueWaitingJobs: "En cola: {waiting}",
    queueOldest: "el m\xE1s antiguo lleva {age}",
    queueLiveHosts: "Imprime desde {n} dispositivo(s).",
    queueAllClear: "Todo al d\xEDa: la cola est\xE1 vac\xEDa y hay {n} dispositivo(s) conectado(s).",
    queueAllClearNoHost: "Ahora mismo no hay nada en cola. No hay ning\xFAn dispositivo de impresi\xF3n conectado: los trabajos nuevos quedar\xE1n en la cola hasta que uno se conecte.",
    statusReady: "Listo",
    statusStalled: "En cola, sin impresora",
    statusUnattended: "Sin impresora conectada",
    jobPending: "Pendiente",
    jobPrinting: "Imprimiendo",
    jobDead: "Muerto",
    jobAttempts: "intentos: {n}",
    jobLastError: "\xDAltimo error: {error}",
    jobAge: "esperando {age}",
    errQueueLoad: "No se pudo leer la cola de impresi\xF3n.",
    docKitchenOrder: "Comanda de cocina",
    docReceipt: "Recibo",
    docInvoice: "Factura",
    docDeliveryNote: "Albar\xE1n",
    docBarcodeLabel: "Etiqueta de c\xF3digo de barras",
    docCashSessionReport: "Cierre de caja",
    docPrebill: "Cuenta preliminar",
    docGeneric: "Documento",
    unitS: "s",
    unitMin: "min",
    unitH: "h",
    jobRetry: "Reintentar",
    jobDiscard: "Descartar",
    jobDiscardTitle: "\xBFDescartar este trabajo? No se imprimir\xE1, y queda registrado.",
    jobDiscardReason: "Motivo (opcional)",
    jobDiscardConfirm: "S\xED, descartar",
    jobCancel: "Cancelar",
    jobRetried: "Vuelve a la cola: lo imprimir\xE1 el pr\xF3ximo dispositivo que se conecte.",
    jobDiscarded: "Trabajo descartado. No se imprimir\xE1 y ya no bloquea su estaci\xF3n.",
    errJobNotRequeueable: "Solo se puede reintentar un trabajo que se ha dado por vencido; este est\xE1 {status}.",
    errJobNotRequeueableUnknown: "Solo se puede reintentar un trabajo que se ha dado por vencido. La lista se acaba de actualizar.",
    errJobNotDiscardable: "No se puede descartar un trabajo que una impresora est\xE1 sacando; este est\xE1 {status}.",
    errJobNotDiscardableUnknown: "Este trabajo ya no se puede descartar. La lista se acaba de actualizar.",
    errJobGone: "Ese trabajo ya no est\xE1 en la cola. La lista se acaba de actualizar.",
    errJobCapability: "El permiso de impresi\xF3n no est\xE1 concedido, as\xED que todav\xEDa no se pueden mover trabajos.",
    errJobGoPermissions: "Ir a Permisos",
    errJobForbidden: "Solo quien administra el negocio puede mover trabajos de la cola de impresi\xF3n.",
    errJobAction: "No se pudo mover el trabajo. Int\xE9ntalo de nuevo en un momento."
  }
};

// locales/en.json
var en_default = {
  name: "Printing",
  navigation: {
    printing: {
      label: "Printers"
    }
  },
  setup: {
    title: "Your printer",
    description: "Put your business details on the receipt and assign the printer that prints it."
  },
  ui: {
    printersTitle: "Printers",
    printersIntro: "Configure receipt printing and the printers found on this network.",
    ticketSettings: "Ticket settings",
    receiptHeader: "Receipt header",
    receiptHeaderPlaceholder: "My business \xB7 Tax ID \xB7 address",
    receiptFooter: "Receipt footer",
    receiptFooterPlaceholder: "Thank you for your purchase!",
    paperWidth: "Paper width",
    autoPrintOnSale: "Print receipt on checkout",
    openDrawerOnSale: "Open drawer on checkout",
    saving: "Saving\u2026",
    saveSettings: "Save settings",
    saved: "\u2713 Saved",
    networkPrinters: "Network printers",
    scanning: "Scanning\u2026",
    rescan: "Rescan",
    printerReady: "This device can reach printers",
    hardwareUnavailable: "This device cannot reach printers from the browser. Install the ERPlora app on the device that is connected to the printer and open your business from there.",
    noPrintersFound: "No network printers (port 9100) were found on this subnet.",
    rolePlaceholder: "Role",
    test: "Test",
    roleReceipt: "Receipt",
    roleKitchen: "Kitchen",
    roleBar: "Bar",
    roleLabel: "Label",
    errLoadSettings: "Could not load settings",
    errSaveSettings: "Could not save",
    errScan: "Error while scanning",
    warnA4Printer: "This looks like an office (A4) printer and does not understand receipts. Tickets and kitchen orders need a thermal printer.",
    errAssignRole: "Could not assign the role",
    errTestPrint: "Test print failed",
    loading: "Loading\u2026",
    queueTitle: "Print queue",
    queueRefresh: "Refresh",
    queueRefreshing: "Refreshing\u2026",
    queueAlertWaiting: "{waiting} print job(s) for {role} have been waiting {age}.",
    queueNoDevice: "No device for this role is connected: install the ERPlora app on the device that is connected to the printer and open your business from there.",
    queueWaitingJobs: "Waiting: {waiting}",
    queueOldest: "oldest has waited {age}",
    queueLiveHosts: "Printing from {n} device(s).",
    queueAllClear: "All clear: the queue is empty and {n} device(s) are connected.",
    queueAllClearNoHost: "Nothing is waiting right now. No print device is connected: new jobs will stay in the queue until one connects.",
    statusReady: "Ready",
    statusStalled: "Waiting, no printer",
    statusUnattended: "No printer connected",
    jobPending: "Pending",
    jobPrinting: "Printing",
    jobDead: "Dead",
    jobAttempts: "attempts: {n}",
    jobLastError: "Last error: {error}",
    jobAge: "waiting {age}",
    errQueueLoad: "Could not read the print queue.",
    docKitchenOrder: "Kitchen order",
    docReceipt: "Receipt",
    docInvoice: "Invoice",
    docDeliveryNote: "Delivery note",
    docBarcodeLabel: "Barcode label",
    docCashSessionReport: "Cash session report",
    docPrebill: "Pre-bill",
    docGeneric: "Document",
    unitS: "s",
    unitMin: "min",
    unitH: "h",
    jobRetry: "Try again",
    jobDiscard: "Discard",
    jobDiscardTitle: "Discard this job? It will not be printed, and the record stays.",
    jobDiscardReason: "Reason (optional)",
    jobDiscardConfirm: "Yes, discard",
    jobCancel: "Cancel",
    jobRetried: "Sent back to the queue: the next device to connect will print it.",
    jobDiscarded: "Job discarded. It will not be printed and it no longer blocks its station.",
    errJobNotRequeueable: "Only a job that has given up can be sent back; this one is {status}.",
    errJobNotRequeueableUnknown: "Only a job that has given up can be sent back. The list has just been refreshed.",
    errJobNotDiscardable: "A job a printer is working on cannot be discarded; this one is {status}.",
    errJobNotDiscardableUnknown: "This job cannot be discarded any more. The list has just been refreshed.",
    errJobGone: "That job is no longer in this queue. The list has just been refreshed.",
    errJobCapability: "Printing permission has not been granted, so jobs cannot be moved yet.",
    errJobGoPermissions: "Go to Permissions",
    errJobForbidden: "Only whoever manages the business can move jobs in the print queue.",
    errJobAction: "The job could not be moved. Try again in a moment."
  }
};

// ui/components/erp-printing-settings/erp-printing-settings.ts
var CATALOG = { es: es_default, en: en_default };
var DEFAULTS = {
  receipt_header: "",
  receipt_footer: "",
  paper_width: 80,
  auto_print_on_sale: 1,
  open_drawer_on_sale: 0,
  print_kitchen: 0
};
var ROLES = ["receipt", "kitchen", "bar", "label"];
var MODULE_ID = "printing";
var ADMINISTER_PERMISSION = "hub.administer";
var PERMISSIONS_ROUTE = "/settings#permissions";
var QUEUE_REFRESH_MS = 3e4;
var QUEUE_LIMIT = 100;
var QUEUE_STATUSES = ["pending", "printing", "dead"];
var RETRYABLE_STATUS = "dead";
var DISCARDABLE_STATUSES = ["pending", "dead"];
var NOT_REQUEUEABLE = "print.job_not_requeueable";
var NOT_DISCARDABLE = "print.job_not_discardable";
var NOT_FOUND = "not_found";
var CAPABILITY_DENIED = "capability_denied";
var FORBIDDEN = "forbidden";
function codeOf(e4) {
  const code = e4?.code;
  return typeof code === "string" ? code : "";
}
function classifyCoverage(c4) {
  if (c4.liveHosts > 0) return "ready";
  return c4.waiting > 0 ? "stalled" : "unattended";
}
function formatWait(seconds) {
  const s4 = Math.max(0, Math.floor(seconds));
  if (s4 < 60) return { value: s4, unit: "ui.unitS" };
  if (s4 < 3600) return { value: Math.floor(s4 / 60), unit: "ui.unitMin" };
  return { value: Math.floor(s4 / 3600), unit: "ui.unitH" };
}
function erplora() {
  const c4 = globalThis.erplora;
  if (!c4) throw new Error("erplora SDK no inicializado por el shell");
  return c4;
}
var ErpPrintingSettings = class extends i3 {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    this.saving = false;
    this.saved = false;
    this.error = "";
    this.hardwareOnline = false;
    this.appVersion = "";
    this.scanning = false;
    this.printers = [];
    this.devices = [];
    this.hardwareError = "";
    this.coverage = [];
    this.queue = [];
    this.queueLoading = false;
    this.queueError = "";
    this.queueLoaded = false;
    this.discardingId = "";
    this.discardReason = "";
    this.jobBusyId = "";
    this.jobNotice = null;
    // Re-render al cambiar el idioma del shell (ADR-0055): el template se re-evalúa con el nuevo
    // `erplora.locale`.
    this.onLocaleChange = () => this.requestUpdate();
  }
  static {
    this.styles = i`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    h2 { margin:0 0 .25rem; font-size:1.15rem; }
    h3 { margin:1.25rem 0 .5rem; font-size:1rem; }
    section { margin-bottom:1rem; }
    .field { display:flex; flex-direction:column; gap:.25rem; margin-bottom:.6rem; max-width:520px; }
    .row { display:flex; align-items:center; gap:.5rem; justify-content:space-between; max-width:520px; margin-bottom:.6rem; }
    .printer { display:flex; align-items:center; gap:.6rem; padding:.6rem .75rem; border:1px solid #0001; border-radius:.5rem; margin-bottom:.5rem; flex-wrap:wrap; }
    .printer .id { font-family:ui-monospace, monospace; font-size:.8rem; opacity:.7; }
    .grow { flex:1; min-width:160px; }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; }
    .muted { opacity:.65; font-size:.85rem; }
    .badge { font-size:.7rem; padding:.1rem .45rem; border-radius:999px; background:#0001; }
    /* printing#28 — the queue. Cards, not a table: at 390 px a table is the failure mode of
       sales#126, and this data is one-line-per-job anyway. The roles fold by themselves
       (auto-fit + minmax capped at 230 px, narrower than any phone viewport) and every row wraps
       and breaks long job ids instead of overflowing the outlet. */
    .queue-alert { border:1px solid #e8590c66; border-left:4px solid #e8590c; background:#fff4e6; color:#a6410c; padding:.6rem .75rem; border-radius:.5rem; margin-bottom:.5rem; min-width:0; overflow-wrap:anywhere; }
    .queue-roles { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:.5rem; margin:.5rem 0 .75rem; }
    .queue-role { border:1px solid #0001; border-radius:.5rem; padding:.6rem .75rem; min-width:0; }
    .queue-role-status { display:inline-block; font-size:.7rem; padding:.1rem .45rem; border-radius:999px; margin-bottom:.35rem; }
    .queue-role-status.ready { background:#d3f9d8; color:#2b8a3e; }
    .queue-role-status.stalled { background:#ffe3e3; color:#c92a2a; }
    .queue-role-status.unattended { background:#fff3bf; color:#a68100; }
    .queue-role .hosts { font-size:.85rem; opacity:.75; }
    .queue-job { display:flex; align-items:flex-start; gap:.6rem; padding:.6rem .75rem; border:1px solid #0001; border-radius:.5rem; margin-bottom:.5rem; flex-wrap:wrap; min-width:0; overflow-wrap:anywhere; }
    .queue-job .id { font-family:ui-monospace, monospace; font-size:.8rem; opacity:.7; }
    .queue-job .meta { font-size:.8rem; opacity:.75; white-space:nowrap; }
    .queue-job .badge.st-dead { background:#ffe3e3; color:#c92a2a; }
    .queue-job .badge.st-printing { background:#d0ebff; color:#1971c2; }
    /* printing#30 — the two recovery gestures. The row already wraps; the action group wraps too
       and takes the full width so that at 390 px the buttons drop under the job instead of
       squeezing the id off the card. The retire confirmation reuses the same box. */
    .job-actions { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; width:100%; margin-top:.4rem; min-width:0; }
    .job-actions.job-discard { border-top:1px dashed #0002; padding-top:.5rem; }
    .job-actions .job-discard-reason { min-width:180px; }
    .job-notice { margin:.25rem 0 .5rem; display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; min-width:0; overflow-wrap:anywhere; }
  `;
  }
  /** Hardware vía el cliente del Hub (nunca un cliente de periféricos propio). */
  get peripherals() {
    return erplora().peripherals;
  }
  async firstUpdated() {
    void this.loadQueue();
    this.startQueueTimer();
    await this.loadSettings();
    await this.refreshHardware();
  }
  // ── Cola del hub (printing#28) ─────────────────────────────────────────────────────────────
  /**
   * One read = the per-role coverage plus the three buckets the screen shows, all of them core
   * queries through the dispatcher (hub#1107). `done` is deliberately NOT asked for: it is history,
   * not state, and the hub lists in arrival order — with a lifetime of completed tickets the
   * interesting rows would never make it into the page.
   */
  async loadQueue() {
    this.queueLoading = true;
    try {
      const [coverage, ...buckets] = await Promise.all([
        // Both names are written as LITERALS on purpose: ADR-0127 extracts the module's
        // interoperability contract from the call site, and a constant hides the dependency.
        // `hub.print.coverage` = per-role coverage; `hub.print.jobs` = the queue as a STATUS
        // view (the document itself never travels through this door).
        erplora().query("hub.print.coverage"),
        ...QUEUE_STATUSES.map(
          (status) => erplora().query("hub.print.jobs", { status, limit: QUEUE_LIMIT })
        )
      ]);
      const oldest = (a3, b3) => Date.parse(a3.createdAt) - Date.parse(b3.createdAt);
      this.coverage = Array.isArray(coverage) ? coverage : [];
      this.queue = buckets.flatMap((rows) => Array.isArray(rows) ? [...rows].sort(oldest) : []);
      this.queueError = "";
      this.queueLoaded = true;
    } catch (e4) {
      const code = codeOf(e4);
      this.queueError = `${erplora().t(CATALOG, "ui.errQueueLoad")}${code ? ` (${code})` : ""}`;
    } finally {
      this.queueLoading = false;
    }
  }
  // ── Getting ONE job out of the jam (printing#30 · hub#1108) ────────────────────────────────
  /**
   * Whether to OFFER the two gestures at all. UI only — the runtime re-checks the admin session and
   * the `printer` capability on every call and refuses on its own.
   *
   * Not offered is not the same as `disabled`: an Ionic control that is disabled eats the tap and
   * leaves the reason in a `title` nobody on a touch screen will ever see.
   */
  get canManageQueue() {
    return erplora().hasPermission(ADMINISTER_PERMISSION);
  }
  get printQueueApi() {
    return erplora().forModule(MODULE_ID).printQueue;
  }
  /** Runs one recovery gesture and ALWAYS re-reads the queue, so what is painted next is the truth. */
  async runJobGesture(jobId, kind, gesture) {
    this.jobBusyId = jobId;
    this.jobNotice = null;
    try {
      await gesture();
      this.jobNotice = { jobId, kind };
    } catch (e4) {
      this.jobNotice = { jobId, kind: "refused", code: codeOf(e4) };
    } finally {
      this.jobBusyId = "";
      await this.loadQueue();
    }
  }
  retryJob(jobId) {
    return this.runJobGesture(jobId, "retried", () => this.printQueueApi.retry(jobId));
  }
  confirmDiscard(jobId) {
    const reason = this.discardReason.trim() || void 0;
    this.discardingId = "";
    this.discardReason = "";
    return this.runJobGesture(jobId, "discarded", () => this.printQueueApi.discard(jobId, reason));
  }
  openDiscard(jobId) {
    this.discardingId = jobId;
    this.discardReason = "";
    this.jobNotice = null;
  }
  cancelDiscard() {
    this.discardingId = "";
    this.discardReason = "";
  }
  /** Same in-shell navigation the other modules use: push the route and let the router pick it up. */
  go(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  /** Self-refresh, paused while the tab is hidden — a background tab polling every 30 s is noise. */
  startQueueTimer() {
    this.queueTimerId = window.setInterval(() => {
      if (document.visibilityState === "visible") void this.loadQueue();
    }, QUEUE_REFRESH_MS);
  }
  async loadSettings() {
    try {
      const rows = await erplora().query("printing.settings.get");
      if (Array.isArray(rows) && rows[0]) this.settings = { ...DEFAULTS, ...rows[0] };
    } catch (e4) {
      this.error = e4 instanceof Error ? e4.message : erplora().t(CATALOG, "ui.errLoadSettings");
    }
  }
  async saveSettings() {
    this.saving = true;
    this.saved = false;
    this.error = "";
    try {
      await erplora().command("printing.settings.update", { ...this.settings });
      this.saved = true;
    } catch (e4) {
      this.error = e4 instanceof Error ? e4.message : erplora().t(CATALOG, "ui.errSaveSettings");
    } finally {
      this.saving = false;
    }
  }
  async refreshHardware() {
    this.hardwareError = "";
    const status = await this.peripherals.detect();
    this.hardwareOnline = status.online;
    this.appVersion = status.version ?? "";
    if (status.online) await this.scan();
  }
  async scan() {
    this.scanning = true;
    this.hardwareError = "";
    try {
      this.printers = await this.peripherals.discoverPrinters();
      this.devices = await this.peripherals.getDevices();
    } catch (e4) {
      this.hardwareError = e4 instanceof Error ? e4.message : erplora().t(CATALOG, "ui.errScan");
    } finally {
      this.scanning = false;
    }
  }
  /**
   * Clave estable de la impresora en el registro de periféricos: su MAC si el sistema la resolvió por
   * ARP y, si no, su propio `id` (`network:{ip}:{port}`).
   *
   * Antes esto exigía MAC y abortaba sin ella, así que en Android —donde ARP **nunca** resuelve—
   * no se podía asignar ninguna impresora a cocina/barra/caja.
   */
  deviceKeyOf(printer) {
    return printer.mac ?? printer.id;
  }
  async assignRole(printer, role) {
    this.hardwareError = printer.category === "a4" ? erplora().t(CATALOG, "ui.warnA4Printer") : "";
    try {
      this.devices = await this.peripherals.setDeviceRole(this.deviceKeyOf(printer), role);
    } catch (e4) {
      this.hardwareError = e4 instanceof Error ? e4.message : erplora().t(CATALOG, "ui.errAssignRole");
    }
  }
  async test(printer) {
    this.hardwareError = "";
    try {
      await this.peripherals.testPrint(printer.id);
    } catch (e4) {
      this.hardwareError = e4 instanceof Error ? e4.message : erplora().t(CATALOG, "ui.errTestPrint");
    }
  }
  roleOf(printer) {
    const key = this.deviceKeyOf(printer);
    const d3 = this.devices.find((x2) => (x2.key ?? x2.mac) === key);
    return d3?.role ?? "";
  }
  // Etiqueta i18n para un rol/estación lógica (el `value=` enviado al host sigue siendo el enum).
  roleLabel(role) {
    const keys = {
      receipt: "ui.roleReceipt",
      kitchen: "ui.roleKitchen",
      bar: "ui.roleBar",
      label: "ui.roleLabel"
    };
    return keys[role] ? erplora().t(CATALOG, keys[role]) : role;
  }
  // Etiqueta i18n de un tipo de documento del vocabulario de la cola (`print_queue::DOCUMENT_TYPES`).
  // Fuera del vocabulario (un hub más nuevo que este módulo) se muestra el enum crudo, no un fallo.
  docLabel(documentType) {
    const keys = {
      kitchen_order: "ui.docKitchenOrder",
      receipt: "ui.docReceipt",
      invoice: "ui.docInvoice",
      delivery_note: "ui.docDeliveryNote",
      barcode_label: "ui.docBarcodeLabel",
      cash_session_report: "ui.docCashSessionReport",
      prebill: "ui.docPrebill",
      generic: "ui.docGeneric"
    };
    return keys[documentType] ? erplora().t(CATALOG, keys[documentType]) : documentType;
  }
  /** `{value} {unit}` ya traducido: «29 min», «45 s», «1 h». */
  waitText(seconds, t3) {
    const w2 = formatWait(seconds);
    return `${w2.value} ${t3(w2.unit)}`;
  }
  /** Badge y frase de estado de un rol — la misma clasificación que la pantalla del hub (hub#800). */
  roleStatusKey(status) {
    return { ready: "ui.statusReady", stalled: "ui.statusStalled", unattended: "ui.statusUnattended" }[status];
  }
  jobStatusKey(status) {
    const keys = {
      pending: "ui.jobPending",
      printing: "ui.jobPrinting",
      dead: "ui.jobDead"
    };
    return keys[status] ?? status;
  }
  /** The job status in the person's words, or the raw enum for a state this module has no name for. */
  jobStatusLabel(status) {
    const key = this.jobStatusKey(status);
    return key === status ? status : erplora().t(CATALOG, key);
  }
  /**
   * What to say after a gesture — resolved by CODE, never by the sentence the runtime sent
   * (ADR-0055).
   *
   * The two `409`s carry the state the job is really in, and the SDK's `ErploraError` does not
   * surface that field — so the state is read from the queue as it stands AFTER the re-read the
   * gesture always does. That is the authoritative answer: the refusal happened precisely because
   * the row on screen was stale. When the job is no longer in any bucket we have nothing to name and
   * say so, rather than naming a state we would be guessing.
   */
  noticeSpeech(notice) {
    if (notice.kind === "retried") return { key: "ui.jobRetried" };
    if (notice.kind === "discarded") return { key: "ui.jobDiscarded" };
    const fresh = this.queue.find((j) => j.jobId === notice.jobId)?.status;
    const named = (key, fallback) => fresh ? { key, params: { status: this.jobStatusLabel(fresh) } } : { key: fallback };
    switch (notice.code) {
      case NOT_REQUEUEABLE:
        return named("ui.errJobNotRequeueable", "ui.errJobNotRequeueableUnknown");
      case NOT_DISCARDABLE:
        return named("ui.errJobNotDiscardable", "ui.errJobNotDiscardableUnknown");
      case NOT_FOUND:
        return { key: "ui.errJobGone" };
      case CAPABILITY_DENIED:
        return { key: "ui.errJobCapability" };
      case FORBIDDEN:
        return { key: "ui.errJobForbidden" };
      default:
        return { key: "ui.errJobAction" };
    }
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("erplora:locale-changed", this.onLocaleChange);
  }
  disconnectedCallback() {
    window.removeEventListener("erplora:locale-changed", this.onLocaleChange);
    window.clearInterval(this.queueTimerId);
    this.queueTimerId = void 0;
    super.disconnectedCallback();
  }
  set(key, value) {
    this.settings = { ...this.settings, [key]: value };
    this.saved = false;
  }
  /**
   * How many devices are draining this hub right now, across every station.
   *
   * The coverage view carries a COUNT and not the hosts' labels, so this screen says how many are
   * connected and never invents a name the dispatcher did not send. The registry with its labels
   * only ever travelled over the retired HTTP route.
   */
  get liveHostCount() {
    return this.coverage.reduce((n5, c4) => n5 + c4.liveHosts, 0);
  }
  /** The outcome of the last gesture, or the refusal explained by its code. */
  renderJobNotice(t3) {
    const notice = this.jobNotice;
    if (!notice) return A;
    const { key, params } = this.noticeSpeech(notice);
    const refused = notice.kind === "refused";
    return b2`
      <p class="job-notice ${refused ? "err" : "ok"}">
        ${t3(key, params)}
        ${notice.code === CAPABILITY_DENIED ? b2`<ion-button class="job-notice-permissions" size="small" fill="outline"
              @click=${() => this.go(PERMISSIONS_ROUTE)}>${t3("ui.errJobGoPermissions")}</ion-button>` : A}
      </p>
    `;
  }
  /**
   * The two gestures, offered only where they can work.
   *
   * A `printing` job gets neither: its lease already covers a host that died, and binning a ticket a
   * live host is rendering is the silent loss the queue exists to prevent. And nothing at all is
   * offered without the admin session — NOT a disabled button, which on a touch screen swallows the
   * tap and hides the reason in a `title`.
   */
  renderJobActions(j, t3) {
    if (!this.canManageQueue) return A;
    const canRetry = j.status === RETRYABLE_STATUS;
    const canDiscard = DISCARDABLE_STATUSES.includes(j.status);
    if (!canRetry && !canDiscard) return A;
    const busy = this.jobBusyId === j.jobId;
    if (this.discardingId === j.jobId) {
      return b2`
        <div class="job-actions job-discard">
          <span class="grow">${t3("ui.jobDiscardTitle")}</span>
          <ion-input class="job-discard-reason grow" mode="md" fill="outline" label-placement="floating"
            label=${t3("ui.jobDiscardReason")} .value=${this.discardReason}
            @ionInput=${(e4) => {
        const detail = e4.detail;
        this.discardReason = detail?.value ?? e4.target.value ?? "";
      }}></ion-input>
          <ion-button class="job-discard-confirm" size="small" color="danger" ?disabled=${busy}
            @click=${() => void this.confirmDiscard(j.jobId)}>${t3("ui.jobDiscardConfirm")}</ion-button>
          <ion-button class="job-discard-cancel" size="small" fill="outline"
            @click=${() => this.cancelDiscard()}>${t3("ui.jobCancel")}</ion-button>
        </div>
      `;
    }
    return b2`
      <div class="job-actions">
        ${canRetry ? b2`<ion-button class="job-action-retry" size="small" fill="outline" ?disabled=${busy}
              @click=${() => void this.retryJob(j.jobId)}>${t3("ui.jobRetry")}</ion-button>` : A}
        ${canDiscard ? b2`<ion-button class="job-action-discard" size="small" fill="outline" ?disabled=${busy}
              @click=${() => this.openDiscard(j.jobId)}>${t3("ui.jobDiscard")}</ion-button>` : A}
      </div>
    `;
  }
  render() {
    const s4 = this.settings;
    const t3 = (k2, params) => erplora().t(CATALOG, k2, params);
    return b2`
      <h2>${t3("ui.printersTitle")}</h2>
      <p class="muted">${t3("ui.printersIntro")}</p>

      <section>
        <div class="row">
          <h3 style="margin:0">${t3("ui.queueTitle")}</h3>
          <ion-button class="queue-refresh" size="small" fill="outline" ?disabled=${this.queueLoading}
            @click=${() => void this.loadQueue()}>
            ${this.queueLoading ? t3("ui.queueRefreshing") : t3("ui.queueRefresh")}
          </ion-button>
        </div>
        ${this.queueError ? b2`<p class="err">${this.queueError}</p>` : A}
        ${this.renderJobNotice(t3)}
        ${this.queueLoaded && !this.queueError ? this.coverage.filter((c4) => c4.undrained).map(
      (c4) => b2`
                  <div class="queue-alert">
                    ${t3("ui.queueAlertWaiting", {
        waiting: c4.waiting,
        role: this.roleLabel(c4.role),
        age: this.waitText(c4.waitingSeconds, t3)
      })}
                    ${t3("ui.queueNoDevice")}
                  </div>
                `
    ) : A}
        ${this.queueLoaded && !this.queueError && this.queue.length === 0 ? this.liveHostCount > 0 ? b2`<p class="ok">${t3("ui.queueAllClear", { n: this.liveHostCount })}</p>` : b2`<p class="muted">${t3("ui.queueAllClearNoHost")}</p>` : A}
        <div class="queue-roles">
          ${this.coverage.map((c4) => {
      const status = classifyCoverage(c4);
      return b2`
              <div class="queue-role">
                <div><span class="queue-role-status ${status}">${t3(this.roleStatusKey(status))}</span></div>
                <div><strong>${this.roleLabel(c4.role)}</strong></div>
                ${c4.waiting > 0 ? b2`<div>${t3("ui.queueWaitingJobs", { waiting: c4.waiting })} · ${t3("ui.queueOldest", { age: this.waitText(c4.waitingSeconds, t3) })}</div>` : A}
                ${c4.liveHosts > 0 ? b2`<div class="hosts">${t3("ui.queueLiveHosts", { n: c4.liveHosts })}</div>` : A}
              </div>
            `;
    })}
        </div>
        ${this.queue.map(
      (j) => b2`
            <div class="queue-job">
              <div class="grow">
                <div>${this.docLabel(j.documentType)} <span class="badge st-${j.status}">${t3(this.jobStatusKey(j.status))}</span></div>
                <div class="id">${j.jobId} · ${this.roleLabel(j.role)} · ${t3("ui.jobAge", { age: this.waitText((Date.now() - Date.parse(j.createdAt)) / 1e3, t3) })}</div>
                ${j.lastError ? b2`<div class="err">${t3("ui.jobLastError", { error: j.lastError })}</div>` : A}
              </div>
              <div class="meta">${t3("ui.jobAttempts", { n: j.attempts })}</div>
              ${this.renderJobActions(j, t3)}
            </div>
          `
    )}
      </section>

      <section>
        <h3>${t3("ui.ticketSettings")}</h3>
        <div class="field">
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t3("ui.receiptHeader")} .value=${s4.receipt_header} placeholder=${t3("ui.receiptHeaderPlaceholder")}
            @ionInput=${(e4) => this.set("receipt_header", e4.target.value)}></ion-input>
        </div>
        <div class="field">
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t3("ui.receiptFooter")} .value=${s4.receipt_footer} placeholder=${t3("ui.receiptFooterPlaceholder")}
            @ionInput=${(e4) => this.set("receipt_footer", e4.target.value)}></ion-input>
        </div>
        <div class="row">
          <label>${t3("ui.paperWidth")}</label>
          <ion-select .value=${String(s4.paper_width)} interface="popover"
            @ionChange=${(e4) => this.set("paper_width", Number(e4.target.value))}>
            <ion-select-option value="80">80 mm</ion-select-option>
            <ion-select-option value="58">58 mm</ion-select-option>
          </ion-select>
        </div>
        <div class="row">
          <label>${t3("ui.autoPrintOnSale")}</label>
          <ion-toggle ?checked=${s4.auto_print_on_sale === 1}
            @ionChange=${(e4) => this.set("auto_print_on_sale", e4.target.checked ? 1 : 0)}></ion-toggle>
        </div>
        <div class="row">
          <label>${t3("ui.openDrawerOnSale")}</label>
          <ion-toggle ?checked=${s4.open_drawer_on_sale === 1}
            @ionChange=${(e4) => this.set("open_drawer_on_sale", e4.target.checked ? 1 : 0)}></ion-toggle>
        </div>
        <ion-button size="small" ?disabled=${this.saving} @click=${() => this.saveSettings()}>
          ${this.saving ? t3("ui.saving") : t3("ui.saveSettings")}
        </ion-button>
        ${this.saved ? b2`<span class="ok"> ${t3("ui.saved")}</span>` : A}
        ${this.error ? b2`<p class="err">${this.error}</p>` : A}
      </section>

      <section>
        <div class="row">
          <h3 style="margin:0">${t3("ui.networkPrinters")}</h3>
          <ion-button size="small" fill="outline" ?disabled=${this.scanning} @click=${() => this.refreshHardware()}>
            ${this.scanning ? t3("ui.scanning") : t3("ui.rescan")}
          </ion-button>
        </div>
        ${this.hardwareOnline ? b2`<p class="muted">${t3("ui.printerReady")}${this.appVersion ? b2` · v${this.appVersion}` : A}.</p>` : b2`<p class="err">${t3("ui.hardwareUnavailable")}</p>`}
        ${this.hardwareError ? b2`<p class="err">${this.hardwareError}</p>` : A}
        ${this.hardwareOnline && this.printers.length === 0 && !this.scanning ? b2`<p class="muted">${t3("ui.noPrintersFound")}</p>` : A}
        ${this.printers.map(
      (p3) => b2`
            <div class="printer">
              <div class="grow">
                <div>${p3.name} <span class="badge">${p3.status}</span></div>
                <div class="id">${p3.id}${p3.mac ? b2` · ${p3.mac}` : A}</div>
              </div>
              <ion-select placeholder=${t3("ui.rolePlaceholder")} .value=${this.roleOf(p3)} interface="popover"
                @ionChange=${(e4) => this.assignRole(p3, e4.target.value)}>
                ${ROLES.map((r6) => b2`<ion-select-option value=${r6}>${this.roleLabel(r6)}</ion-select-option>`)}
              </ion-select>
              <ion-button size="small" fill="outline" @click=${() => this.test(p3)}>${t3("ui.test")}</ion-button>
            </div>
          `
    )}
      </section>
    `;
  }
};
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "settings", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "saving", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "saved", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "error", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "hardwareOnline", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "appVersion", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "scanning", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "printers", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "devices", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "hardwareError", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "coverage", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "queue", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "queueLoading", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "queueError", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "queueLoaded", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "discardingId", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "discardReason", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "jobBusyId", 2);
__decorateClass([
  r5()
], ErpPrintingSettings.prototype, "jobNotice", 2);
define("erp-printing-settings", ErpPrintingSettings);
export {
  ErpPrintingSettings,
  formatWait
};
