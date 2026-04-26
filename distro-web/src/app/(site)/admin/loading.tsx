export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
        <div className="h-10 w-32 bg-gray-200 rounded-xl"></div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 h-32"></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl h-[400px]"></div>
        <div className="bg-white border border-gray-100 rounded-2xl h-[300px]"></div>
      </div>
    </div>
  );
}
