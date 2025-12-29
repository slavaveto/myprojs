'use client';

import {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import MobileDetect from 'mobile-detect';

type DeviceType = {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isIOS: boolean;
    forcedMode?: 'mobile' | 'tablet' | 'laptop' | null;              // mobile, tablet, laptop или авто (null)
    setForcedMode?: (mode: 'mobile' | 'tablet' | 'laptop' | null) => void;
};

const defaultValue: DeviceType = {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    forcedMode: null,
    setForcedMode: () => {
    },
};

const DeviceContext = createContext<DeviceType>(defaultValue);

export const useDevice = () => useContext(DeviceContext);

export const DeviceProvider = ({children}: { children: ReactNode }) => {
    const [deviceType, setDeviceType] = useState<Omit<DeviceType, 'forcedMode' | 'setForcedMode'>>({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isIOS: false,
    });

    const [forcedMode, setForcedMode] = useState<'mobile' | 'tablet' | 'laptop' | null>(null);

    useEffect(() => {
        const md = new MobileDetect(window.navigator.userAgent);
        const isMobile = !!md.mobile();
        const isTablet = !!md.tablet();
        const isDesktop = !isMobile && !isTablet;

        const userAgent = window.navigator.userAgent || "";
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !("MSStream" in window);

        setDeviceType({isMobile, isTablet, isDesktop, isIOS});
    }, []);

    // Выбираем итоговый режим: принудительный или авто
    const finalIsMobile = forcedMode === "mobile"
        ? true
        : (forcedMode === "tablet" || forcedMode === "laptop" ? false : deviceType.isMobile);

    const finalIsTablet = forcedMode === "tablet"
        ? true
        : (forcedMode === "mobile" || forcedMode === "laptop" ? false : deviceType.isTablet);

    // Desktop только если не мобилка и не планшет
    // Если laptop - это тоже десктоп
    const finalIsDesktop = forcedMode === "laptop" 
        ? true
        : (!finalIsMobile && !finalIsTablet);

    return (
        <DeviceContext.Provider value={{
            ...deviceType,
            isMobile: finalIsMobile,
            isTablet: finalIsTablet,
            isDesktop: finalIsDesktop,
            forcedMode,
            setForcedMode,
        }}>
            {children}
        </DeviceContext.Provider>
    );
};