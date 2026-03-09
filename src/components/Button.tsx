type ButtonSize = 'sm' | 'md' | 'lg';

const ButtonOutline = (props: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: ButtonSize;
}) => {
  return (
    <button
      className={`rounded-full ${
        props.size === 'sm' ? 'text-xs' : props.size === 'lg' ? 'text-lg' : 'text-base'
      } ${
        props.size === 'sm' ? 'px-1.5 py-2' : props.size === 'lg' ? 'p-2' : 'p-1.5'
      }  cursor-pointer active:scale-95 transition-all border-[0.5px] ${
        props.disabled ? 'opacity-40 cursor-not-allowed! hover:bg-white-20!' : ''
      } ${props.className} ${
        props.icon && props.children
          ? 'flex items-center gap-2 pr-3'
          : props.icon
          ? 'size-9 items-center flex justify-center'
          : 'px-4'
      }`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon && (
        <div
          className={`${
            props.size === 'sm' ? 'text-base' : props.size === 'lg' ? 'text-xl' : 'text-xl'
          }`}
        >
          {props.icon}
        </div>
      )}
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
  size?: ButtonSize;
}) => {
  return (
    <ButtonOutline
      size={props.size}
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
  size?: ButtonSize;
}) => {
  return (
    <ButtonOutline
      size={props.size}
      icon={props.icon}
      className={`${props.className} hover:bg-white/15 bg-white/5 text-white border-white/5 backdrop-blur`}
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
  size?: ButtonSize;
}) => {
  return (
    <ButtonOutline
      size={props.size}
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
