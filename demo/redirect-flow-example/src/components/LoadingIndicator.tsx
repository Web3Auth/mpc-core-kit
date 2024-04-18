import "./styles.css";

const LoadingSpinner = () => {
  return (
    <div className="lds-wrapper">
      <div className="lds-container">
        <div className="lds-ring">
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;
