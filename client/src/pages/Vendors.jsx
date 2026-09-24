import CrudManager from '../components/CrudManager';
import { PageHead, Badge } from '../components/ui';
import { useAuth } from '../context/Auth';
import { fmtD } from '../utils';
export default function Vendors() {
  const { can } = useAuth();
  return (<><PageHead title="Vendors" sub="Suppliers and service providers for hardware, software and support." />
    <CrudManager title="Vendors" singular="vendor" endpoint="/vendors" canWrite={can('admin', 'asset_manager')} canDelete={can('admin', 'asset_manager')}
      columns={[{ key: 'name', label: 'Vendor', render: (v) => <b>{v.name}</b> }, { key: 'type', label: 'Type' }, { key: 'contactName', label: 'Contact' }, { key: 'email', label: 'Email' }, { key: 'contractEnd', label: 'Contract ends', render: (v) => fmtD(v.contractEnd) }, { key: 'active', label: 'Status', render: (v) => <Badge tone={v.active ? 'green' : 'gray'}>{v.active ? 'Active' : 'Inactive'}</Badge> }]}
      fields={[{ name: 'name', label: 'Vendor name' }, { name: 'type', label: 'Type', type: 'select', options: ['Hardware', 'Software', 'Network', 'Services'].map((x) => ({ value: x, label: x })) }, { name: 'contactName', label: 'Contact person' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'website', label: 'Website' }, { name: 'contractEnd', label: 'Contract ends', type: 'date' }, { name: 'address', label: 'Address', type: 'textarea' }, { name: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Active vendor' }]} /></>);
}
