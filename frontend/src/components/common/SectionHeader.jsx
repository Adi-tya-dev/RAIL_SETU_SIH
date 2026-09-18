export default function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div className="section-header">
      <div className="section-header__title">
        {Icon && <Icon size={16} aria-hidden="true" />}
        <h2>{title}</h2>
      </div>
      {action && <div className="section-header__action">{action}</div>}
    </div>
  );
}