const RENDER_TO_DOM = Symbol('RENDER_TO_DOM')
export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
    this._range = null
  }

  setAttribute(name, value) {
    this.props[name] = value
  }

  appendChild(component) {
    this.children.push(component)
  }

  [RENDER_TO_DOM](range) {
    this._range = range
    this._vdom = this.vdom
    this._vdom[RENDER_TO_DOM](range)
  }

  update() {
    const isSame = (oldNode, newNode) => {
      if (oldNode.type !== newNode.type) return false
      for (let name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) {
          return false
        }
      }
      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length)
        return false

      if (newNode.type === '#text')
        if (newNode.content !== oldNode.content) return false

      return true
    }
    const update = (oldNode, newNode) => {
      // 1. type
      // 2. props -- patch (toy-react 全替换)
      // 3. children
      // 4. #text content -- patch (toy-react 全替换)
      if (!isSame(oldNode, newNode)) {
        newNode[RENDER_TO_DOM](oldNode._range)
        return
      }
      newNode._range = oldNode._range

      let newChildren = newNode.vchildren
      let oldChildren = oldNode.vchildren

      if (!newChildren || !newChildren.length) {
        return
      }

      let tailRange = oldChildren[oldChildren.length - 1]._range

      for (let i = 0; i < newChildren.length; i++) {
        const newChild = newChildren[i]
        const oldChild = oldChildren[i]
        if (i < oldChildren.length) {
          update(oldChild, newChild)
        } else {
          let range = document.createRange()
          range.setStart(tailRange.endContainer, tailRange.endOffset)
          range.setEnd(tailRange.endContainer, tailRange.endOffset)
          newChild[RENDER_TO_DOM](range)
          tailRange = range
        }
      }
    }

    let vdom = this.vdom
    update(this._vdom, vdom)
    this._vdom = vdom
  }

  /* rerender() {
    let oldRange = this._range
    const range = document.createRange()
    range.setStart(oldRange.startContainer, oldRange.startOffset)
    range.setEnd(oldRange.startContainer, oldRange.startOffset)
    this[RENDER_TO_DOM](range)

    oldRange.setStart(range.endContainer, range.endOffset)
    oldRange.deleteContents()
  } */

  setState(newState) {
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState
      this.update()
      return
    }
    const merge = (oldState, newState) => {
      for (let p in newState) {
        if (oldState[p] === null || typeof oldState[p] !== 'object') {
          oldState[p] = newState[p]
        } else {
          merge(oldState[p], newState[p])
        }
      }
    }

    merge(this.state, newState)
    this.update()
  }

  get vdom() {
    return this.render().vdom
  }

  /* get vchildren() {
    return this.children.map((child) => child.vdom)
  } */
}

class ElementWrapper extends Component {
  constructor(type) {
    super()
    this.type = type
    // this.root = document.createElement(type)
  }

  /* 
  setAttribute(name, value) {
    if (name.match(/^on([\s\S]+)$/i)) {
      const eventName = RegExp.$1.replace(/^[\s\S]/, ($0) => $0.toLowerCase())
      this.root.addEventListener(eventName, value)
    } else {
      if (name.toLowerCase() === 'classname') {
        name = 'class'
      }
      this.root.setAttribute(name, value)
    }
  }

  appendChild(component) {
    let range = document.createRange()
    range.setStart(this.root, this.root.childNodes.length)
    range.setEnd(this.root, this.root.childNodes.length)
    component[RENDER_TO_DOM](range)
  }
 */

  [RENDER_TO_DOM](range) {
    this._range = range
    let root = document.createElement(this.type)
    for (let name in this.props) {
      let value = this.props[name]
      if (name.match(/^on([\s\S]+)$/i)) {
        const eventName = RegExp.$1.replace(/^[\s\S]/, ($0) => $0.toLowerCase())
        root.addEventListener(eventName, value)
      } else {
        if (name.toLowerCase() === 'classname') {
          name = 'class'
        }
        root.setAttribute(name, value)
      }
    }
    if (!this.vchildren)
      this.vchildren = this.children.map((child) => child.vdom)

    for (let child of this.vchildren) {
      let childRange = document.createRange()
      childRange.setStart(root, root.childNodes.length)
      childRange.setEnd(root, root.childNodes.length)
      child[RENDER_TO_DOM](childRange)
    }
    replaceContent(range, root)
  }

  get vdom() {
    this.vchildren = this.children.map((child) => child.vdom)
    return this
  }
}

class TextWrapper extends Component {
  constructor(content) {
    super()
    this.type = '#text'
    this.content = content
  }

  [RENDER_TO_DOM](range) {
    this._range = range
    replaceContent(range, document.createTextNode(this.content))
  }
  get vdom() {
    return this
  }
}

export function createElement(type, attributes = {}, ...children) {
  let el
  if (typeof type === 'string') el = new ElementWrapper(type)
  else el = new type()

  for (let prop in attributes) {
    el.setAttribute(prop, attributes[prop])
  }

  const insertChildren = (children) => {
    for (let child of children || []) {
      if (child === null) continue
      if (typeof child === 'string') child = new TextWrapper(child)
      if (Array.isArray(child)) {
        insertChildren(child)
      } else {
        el.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return el
}

export function render(component, parentElement) {
  let range = document.createRange()
  range.setStart(parentElement, 0)
  range.setEnd(parentElement, parentElement.childNodes.length)
  range.deleteContents()
  component[RENDER_TO_DOM](range)
}

function replaceContent(range, node) {
  range.insertNode(node)

  range.setStartAfter(node)
  range.deleteContents()

  range.setStartBefore(node)
  range.setEndAfter(node)
}
