"use client";

import React, { Suspense } from "react";
import { SquidRouterWidget } from "@/components/SquidRouterWidget";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  return (
    <div className="flex flex-col justify-start items-center h-screen w-screen bg-white mx-auto gap-12">
      <TopBar />
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 48,
        width: 534,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Suspense fallback={
          <div className="flex justify-center items-center h-32 w-full">
            <div className="text-lg">Loading widget...</div>
          </div>
        }>
          <SquidRouterWidget />
        </Suspense>
      </div>
      {/* <div className="w-full pt-12 px-6">
        <ProtocolStats />
      </div> */}
    </div>
  );
}
