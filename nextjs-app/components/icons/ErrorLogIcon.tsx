'use client';

import { FC } from 'react';

interface ErrorLogIconProps {
    className?: string;
    /**
     * 控制图标状态
     * true: 激活状态 (蓝色 #007aff)
     * false: 未激活状态 (黑色 85%透明度)
     */
    isActive?: boolean;
}

const ErrorLogIcon: FC<ErrorLogIconProps> = ({ className, isActive = false }) => {
    return (
        <svg
            className={className}
            viewBox="0 0 20.2832 19.9316"
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="36"
        >
            <g>
                <path
                    d="M15.957 17.002L16.9922 15.9668L3.97461 2.94922L2.93945 3.98438ZM9.96094 19.9219C15.459 19.9219 19.9219 15.459 19.9219 9.96094C19.9219 4.46289 15.459 0 9.96094 0C4.46289 0 0 4.46289 0 9.96094C0 15.459 4.46289 19.9219 9.96094 19.9219ZM9.96094 18.2617C5.37109 18.2617 1.66016 14.5508 1.66016 9.96094C1.66016 5.37109 5.37109 1.66016 9.96094 1.66016C14.5508 1.66016 18.2617 5.37109 18.2617 9.96094C18.2617 14.5508 14.5508 18.2617 9.96094 18.2617Z"
                    fill={isActive ? "#007aff" : "black"}
                    fillOpacity={isActive ? 1 : 0.85}
                />
            </g>
        </svg>
    );
};

export default ErrorLogIcon;
