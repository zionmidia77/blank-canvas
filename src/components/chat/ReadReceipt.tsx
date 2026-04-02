const ReadReceipt = ({ read }: { read: boolean }) => (
  <span className={`inline-flex ml-1 ${read ? "text-blue-400" : "text-primary-foreground/40"}`}>
    <svg viewBox="0 0 16 10" className="w-4 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5.5L4 8.5L10 1.5" />
      <path d="M5 5.5L8 8.5L14 1.5" />
    </svg>
  </span>
);

export default ReadReceipt;
