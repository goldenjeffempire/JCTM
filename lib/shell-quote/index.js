"use strict";

function quote(args) {
  return args
    .map((arg) => {
      const value = String(arg);
      if (value === "") return "''";
      if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
      return "'" + value.replace(/'/g, "'\\''") + "'";
    })
    .join(" ");
}

function parse(command, env = {}, customEscape) {
  const words = [];
  let word = "";
  let quoteChar = null;
  let escaped = false;

  const push = () => {
    if (word !== "") {
      words.push(word);
      word = "";
    }
  };

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (escaped) {
      word += typeof customEscape === "function" ? customEscape(char) : char;
      escaped = false;
    } else if (char === "\\" && quoteChar !== "'") {
      escaped = true;
    } else if (quoteChar) {
      if (char === quoteChar) quoteChar = null;
      else word += char;
    } else if (char === "'" || char === '"') {
      quoteChar = char;
    } else if (/\s/.test(char)) {
      push();
    } else if (/[|&;()<>]/.test(char)) {
      push();
      let op = char;
      if (command[i + 1] === char || (char === ">" && command[i + 1] === ">")) {
        op += command[++i];
      }
      words.push({ op });
    } else if (char === "$") {
      const match = command.slice(i + 1).match(/^\{?([A-Za-z_][A-Za-z0-9_]*)\}?/);
      if (match) {
        word += typeof env === "function" ? env(match[1]) : env[match[1]] ?? "";
        i += match[0].length;
      } else {
        word += char;
      }
    } else {
      word += char;
    }
  }
  if (escaped) word += "\\";
  push();
  return words;
}

exports.quote = quote;
exports.parse = parse;