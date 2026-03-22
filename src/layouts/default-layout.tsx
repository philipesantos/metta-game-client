import type React from "react";
function DefaultLayout({children}: { children: React.ReactNode }) {
    return (
        <div className="forest-background relative min-h-screen text-emerald-50">
            <div className="forest-overlay" aria-hidden="true" />
            {children}
        </div>
    );
}

export default DefaultLayout;
