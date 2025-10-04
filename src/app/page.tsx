import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Universal Expense Manager
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Streamline expense management for your company. Create your company account and start managing expenses with your team.
          </p>
          
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            <Link
              href="/login?mode=create-company"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors inline-block"
            >
              Create a Company
            </Link>
            <Link
              href="/login"
              className="border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 font-medium py-3 px-8 rounded-lg transition-colors inline-block"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Team Management
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create user accounts with company-assigned email IDs and manage team roles and permissions.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Project Organization
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Organize expenses by projects and track spending across different departments and initiatives.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Approval Workflows
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Set up approval policies and automated workflows for expense management and compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
