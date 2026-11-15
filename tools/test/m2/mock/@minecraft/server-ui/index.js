class Form { constructor(){ this.log=[]; } title(t){this.log.push(['title',t]);return this;} body(b){this.log.push(['body',b]);return this;}
 button(b){this.log.push(['button',b]);return this;} textField(...a){this.log.push(['text',a]);return this;} toggle(...a){this.log.push(['toggle',a]);return this;}
 show(p){ globalThis.__forms.push(this.log); return Promise.resolve({canceled:true}); } }
globalThis.__forms = [];
export class ActionFormData extends Form {}
export class ModalFormData extends Form {}
