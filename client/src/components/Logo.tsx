export default function Logo({ width = 32, height = 32, className = "" }) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
    >
      {/* Background Circle */}
      <circle cx="50" cy="50" r="48" fill="#065f46" />
      
      {/* Document Icon */}
      <path 
        d="M32 28C32 26.8954 32.8954 26 34 26H56L68 38V72C68 73.1046 67.1046 74 66 74H34C32.8954 74 32 73.1046 32 72V28Z" 
        fill="white" 
      />
      
      {/* Document Fold */}
      <path d="M56 26V38H68" fill="#e2e8f0" />
      
      {/* Document Lines */}
      <path d="M40 45H60" stroke="#065f46" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 53H60" stroke="#065f46" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 61H52" stroke="#065f46" strokeWidth="3" strokeLinecap="round" />
      
      {/* Tracking Arrow / Circular Motion */}
      <path 
        d="M80 50C80 66.5685 66.5685 80 50 80C33.4315 80 20 66.5685 20 50" 
        stroke="rgba(255,255,255,0.4)" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      <path 
        d="M20 50C20 33.4315 33.4315 20 50 20" 
        stroke="white" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeDasharray="0.1 10"
      />
    </svg>
  )
}
