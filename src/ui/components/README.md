# Component contract

Every UI component exports `mount(parent, store): { destroy(): void }`.
`parent` is the component's mount slot and `store` is the typed shared store.
The component owns only the subtree it creates below `parent`.
`destroy()` removes that subtree and releases listeners, timers, and subscriptions.
External strings must be rendered with `textContent` or safe DOM APIs.
Never use `innerHTML`, `outerHTML`, or an HTML-string API.
Keep component styles in a co-named `ComponentName.css` file.
