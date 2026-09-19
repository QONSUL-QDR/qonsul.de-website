import Image from 'next/image';

const logoPath = '/qonsul-logo-selected.png';

export default function Brand(){return <span className="brand-art"><Image src={logoPath} alt="QONSUL Managementberatung" width={1448} height={1086} loading="eager" fetchPriority="high" unoptimized/></span>;}
export function BrandMark(){return <span className="brand-symbol" aria-hidden="true"><Image src={logoPath} alt="" width={1448} height={1086} unoptimized/></span>;}
