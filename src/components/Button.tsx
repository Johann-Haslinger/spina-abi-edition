const ButtonOutline = (props: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) => {
  return (
    <button
      className={`rounded-full text-base p-1.5 cursor-pointer active:scale-95 transition-all border-[0.5px] ${
        props.disabled ? 'opacity-40 cursor-not-allowed! hover:bg-white-20!' : ''
      } ${props.className} ${
        props.icon && props.children
          ? 'flex items-center gap-2'
          : props.icon
          ? 'size-9 items-center flex justify-center'
          : 'px-4'
      }`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon && <div className="text-xl">{props.icon}</div>}
      {props.children}
    </button>
  );
};

export const PrimaryButton = (props: {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <ButtonOutline
      icon={props.icon}
      className={`${props.className} hover:bg-white bg-white/90 text-black border-white`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </ButtonOutline>
  );
};

export const SecondaryButton = (props: {
  children?: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) => {
  return (
    <ButtonOutline
      icon={props.icon}
      className={`${props.className} hover:bg-white/15 bg-white/10 text-white border-white/10`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </ButtonOutline>
  );
};

export const GhostButton = (props: {
  children?: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) => {
  return (
    <ButtonOutline
      icon={props.icon}
      className={`${props.className} hover:bg-white/5 border-none ${
        props.disabled ? 'opacity-40 cursor-not-allowed! hover:bg-white-20!' : ''
      }`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </ButtonOutline>
  );
};
