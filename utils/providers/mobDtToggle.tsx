'use client';

import { Tabs, Tab } from '@heroui/react';
import React from 'react';
import { Smartphone, Tablet, Monitor } from "lucide-react";
import { useDevice } from "@/utils/providers/MobileDetect";

const MobDtToggle: React.FC = () => {
    const { forcedMode, setForcedMode } = useDevice();

    const selectedKey = forcedMode === "mobile" 
        ? "mobile" 
        : forcedMode === "tablet" 
            ? "tablet" 
            : "auto";

    return (
        <Tabs
            aria-label="Device Mode"
            color="default"
            size="sm"
            selectedKey={selectedKey}
            onSelectionChange={key => {
                if (setForcedMode) {
                    if (key === "mobile") setForcedMode("mobile");
                    else if (key === "tablet") setForcedMode("tablet");
                    else setForcedMode(null);
                }
            }}
            classNames={{
                tabList: "gap-[0px] sm:gap-[0px] p-[1px] rounded-[10px] border border-default-200",
                tab: "h-[28px] md:h-[30px] px-[10px] md:px-[8px] rounded-small",
                tabContent: "group-data-[selected=true]:text-primary-400",
            }}
        >
            <Tab
                key="auto"
                title={
                    <div className="flex items-center">
                        <Monitor size={16}/>
                    </div>
                }
            />
            <Tab
                key="tablet"
                title={
                    <div className="flex items-center">
                        <Tablet size={16}/>
                    </div>
                }
            />
            <Tab
                key="mobile"
                title={
                    <div className="flex items-center">
                        <Smartphone size={16}/>
                    </div>
                }
            />
        </Tabs>
    );
};

export default MobDtToggle;
