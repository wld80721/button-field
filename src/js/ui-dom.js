const $ = (id) => document.getElementById(id);

function setValue(target, property, value) {
  if (target[property] !== value) target[property] = value;
}

function setText(element, value) {
  setValue(element, "textContent", String(value));
}

export { $, setText, setValue };
