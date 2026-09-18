export function TextInput({ label, ...rest }) {
  if (!label) return <input type="text" className="input" {...rest} />;
  return (
    <div className="field">
      <label>{label}</label>
      <input type="text" className="input" {...rest} />
    </div>
  );
}

export function Select({ label, children, placeholder, ...rest }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="select" {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </div>
  );
}

export function DateInput({ label, ...rest }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="date" className="input" {...rest} />
    </div>
  );
}

export function NumberInput({ label, ...rest }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" className="input" {...rest} />
    </div>
  );
}