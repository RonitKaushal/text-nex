import React, { memo } from 'react';
import GenericWebView from './GenericWebView';
import ServerTerminal from './ServerTerminal';
import BulkWhatsAppPanel from './BulkWhatsAppPanel';
import LeadGenPanel from './LeadGenPanel';
import type { ServiceTab } from '../types';

interface ServiceRendererProps {
  service: ServiceTab;
  isDarkMode: boolean;
  isActive: boolean;
  isDisabled?: boolean;
  notificationsEnabled?: boolean;
}

function isSshService(service: ServiceTab) {
  return (
    service.kind === 'ssh' ||
    service.type === 'ssh' ||
    service.iconType === 'ubuntu' ||
    service.iconType === 'ssh-server'
  );
}

function isBulkWaService(service: ServiceTab) {
  return (
    service.kind === 'bulk-wa' ||
    service.iconType === 'bulk-whatsapp' ||
    service.type === 'bulk-whatsapp'
  );
}

function isLeadGenService(service: ServiceTab) {
  return (
    service.kind === 'lead-gen' ||
    service.iconType === 'lead-gen' ||
    service.type === 'lead-gen'
  );
}

const ServiceRenderer: React.FC<ServiceRendererProps> = memo(
  ({
    service,
    isDarkMode,
    isActive,
    isDisabled = false,
    notificationsEnabled = true,
  }) => {
    if (isDisabled) return null;

    const containerStyle: React.CSSProperties = {
      height: '100%',
      width: '100%',
      display: isActive ? 'block' : 'none',
      position: isActive ? 'relative' : 'absolute',
      top: 0,
      left: 0,
      zIndex: isActive ? 1 : 0,
    };

    return (
      <div style={containerStyle}>
        {isBulkWaService(service) ? (
          <BulkWhatsAppPanel
            service={service}
            isDarkMode={isDarkMode}
            isActive={isActive}
          />
        ) : isLeadGenService(service) ? (
          <LeadGenPanel
            service={service}
            isDarkMode={isDarkMode}
            isActive={isActive}
          />
        ) : isSshService(service) ? (
          <ServerTerminal
            service={service}
            isDarkMode={isDarkMode}
            isActive={isActive}
          />
        ) : (
          <GenericWebView
            service={service}
            isDarkMode={isDarkMode}
            isActive={isActive}
            notificationsEnabled={notificationsEnabled}
          />
        )}
      </div>
    );
  }
);

ServiceRenderer.displayName = 'ServiceRenderer';

export default ServiceRenderer;
