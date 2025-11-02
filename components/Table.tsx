import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, Linking, Button, Dimensions } from 'react-native';
import Svg, { Path } from "react-native-svg";

interface StudentItem {
  id: string | number;
  customerName: string;
  phone: string;
  hostel: string;
  size: string;
  price: string;
  status?: string;
}

interface StudentModalProps {
  student: StudentItem | null;
  onClose: () => void;
}

interface CallModalProps {
  student: StudentItem | null;
  onClose: () => void;
  onCall: () => void;
}

interface TableProps {
  tableData?: StudentItem[];
  onStudentPress?: (student: StudentItem) => void;
}

const CallModal = ({ student, onClose, onCall }: CallModalProps) => (
  <View style={styles.callModalContent}>
    <Text style={styles.callModalTitle}>Call {student?.customerName}?</Text>
    <Text style={styles.callModalPhone}>{student?.phone}</Text>
    <View style={styles.callModalButtons}>
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.callButton} onPress={onCall}>
        <Text style={styles.callButtonText}>Call</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const StudentModal = ({ student, onClose }: StudentModalProps) => {
  const [showCallModal, setShowCallModal] = useState(false);

  const handleCall = () => {
    setShowCallModal(false);
    onClose();
    const cleanPhone = student?.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleWhatsApp = () => {
    onClose();
    const cleanPhone = student?.phone.replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  return (
    <>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{student?.customerName}</Text>
          <Text style={styles.modalSubtitle}>{student?.hostel}</Text>
        </View>
        
        <View style={styles.modalInfo}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{student?.phone}</Text>
        </View>

        <View style={styles.modalInfo}>
          <Text style={styles.infoLabel}>Price:</Text>
          <Text style={styles.infoValue}>{student?.price}</Text>
        </View>

        <View style={styles.modalInfo}>
          <Text style={styles.infoLabel}>Size:</Text>
          <Text style={styles.infoValue}>{student?.size}</Text>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.callActionButton]} 
            onPress={() => setShowCallModal(true)}
          >
            <Svg width="20" height="20" viewBox="0 0 12 12" fill="none">
              <Path d="M5.525 7.475L4.6 8.4C4.405 8.595 4.095 8.595 3.895 8.405C3.84 8.35 3.785 8.3 3.73 8.245C3.215 7.725 2.75 7.18 2.335 6.61C1.925 6.04 1.595 5.47 1.355 4.905C1.12 4.335 1 3.79 1 3.27C1 2.93 1.06 2.605 1.18 2.305C1.3 2 1.49 1.72 1.755 1.47C2.075 1.155 2.425 1 2.795 1C2.935 1 3.075 1.03 3.2 1.09C3.33 1.15 3.445 1.24 3.535 1.37L4.695 3.005C4.785 3.13 4.85 3.245 4.895 3.355C4.94 3.46 4.965 3.565 4.965 3.66C4.965 3.78 4.93 3.9 4.86 4.015C4.795 4.13 4.7 4.25 4.58 4.37L4.2 4.765C4.145 4.82 4.12 4.885 4.12 4.965C4.12 5.005 4.125 5.04 4.135 5.08C4.15 5.12 4.165 5.15 4.175 5.18C4.265 5.345 4.42 5.56 4.64 5.82C4.865 6.08 5.105 6.345 5.365 6.61C5.415 6.66 5.47 6.71 5.52 6.76C5.72 6.955 5.725 7.275 5.525 7.475Z" fill="white" />
              <Path d="M10.9848 9.165C10.9848 9.305 10.9598 9.45 10.9098 9.59C10.8948 9.63 10.8798 9.67 10.8598 9.71C10.7748 9.89 10.6648 10.06 10.5198 10.22C10.2748 10.49 10.0048 10.685 9.6998 10.81C9.6948 10.81 9.6898 10.815 9.6848 10.815C9.3898 10.935 9.0698 11 8.7248 11C8.2148 11 7.6698 10.88 7.0948 10.635C6.5198 10.39 5.9448 10.06 5.3748 9.645C5.1798 9.5 4.9848 9.355 4.7998 9.2L6.4348 7.565C6.5748 7.67 6.6998 7.75 6.8048 7.805C6.8298 7.815 6.8598 7.83 6.8948 7.845C6.9348 7.86 6.9748 7.865 7.0198 7.865C7.1048 7.865 7.1698 7.835 7.2248 7.78L7.6048 7.405C7.7298 7.28 7.8498 7.185 7.9648 7.125C8.0798 7.055 8.1948 7.02 8.3198 7.02C8.4148 7.02 8.5148 7.04 8.6248 7.085C8.7348 7.13 8.8498 7.195 8.9748 7.28L10.6298 8.455C10.7598 8.545 10.8498 8.65 10.9048 8.775C10.9548 8.9 10.9848 9.025 10.9848 9.165Z" fill="white" />
            </Svg>
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.whatsappActionButton]} 
            onPress={handleWhatsApp}
          >
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M12 2C6.48 2 2 6.48 2 12C2 13.69 2.49 15.26 3.35 16.59L2 22L7.41 20.65C8.74 21.51 10.31 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 15.5C16.32 16.02 15.36 16.45 14.93 16.5C14.5 16.55 14.1 16.71 12 15.87C9.55 14.87 8 12.34 7.85 12.14C7.7 11.94 6.64 10.53 6.64 9.07C6.64 7.61 7.4 6.89 7.66 6.62C7.92 6.35 8.23 6.28 8.41 6.28C8.59 6.28 8.77 6.28 8.92 6.29C9.08 6.3 9.3 6.23 9.51 6.76C9.72 7.29 10.2 8.75 10.26 8.87C10.32 8.99 10.38 9.15 10.29 9.31C10.2 9.47 10.14 9.57 9.99 9.74C9.84 9.91 9.7 10.04 9.55 10.22C9.41 10.38 9.26 10.55 9.43 10.83C9.6 11.11 10.19 12.1 11.08 12.88C12.23 13.9 13.18 14.23 13.46 14.35C13.74 14.47 13.91 14.44 14.08 14.25C14.25 14.06 14.73 13.5 14.93 13.22C15.13 12.94 15.33 12.99 15.58 13.08C15.83 13.17 17.29 13.89 17.57 14.03C17.85 14.17 18.03 14.24 18.09 14.36C18.15 14.48 18.15 14.99 16.5 15.5Z" fill="white"/>
            </Svg>
            <Text style={styles.actionButtonText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCallModal(false)}
      >
        <View style={styles.callModalContainer}>
          <CallModal 
            student={student} 
            onClose={() => setShowCallModal(false)}
            onCall={handleCall}
          />
        </View>
      </Modal>
    </>
  );
};

const Table = ({ tableData, onStudentPress }: TableProps) => {
  const defaultTableData = [
    {
      id: '011',
      customerName: 'Nana Ama Amankwah',
      phone: '055 414 4611',
      hostel: 'Brunei',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    },
    {
      id: '012',
      customerName: 'Kwame Mensah',
      phone: '020 123 4567',
      hostel: 'Hall 3',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'completed'
    },
    {
      id: '013',
      customerName: 'Ama Serwaa',
      phone: '054 987 6543',
      hostel: 'Hall 5',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'pending'
    },
    {
      id: '014',
      customerName: 'Kofi Owusu',
      phone: '027 555 1234',
      hostel: 'Hall 2',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'in-progress'
    },
    {
      id: '015',
      customerName: 'Abena Pokuaa',
      phone: '024 777 8888',
      hostel: 'Hall 8',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'pending'
    },
    {
      id: '016',
      customerName: 'Yaw Boateng',
      phone: '050 222 3333',
      hostel: 'Hall 4',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'completed'
    },
    {
      id: '017',
      customerName: 'Akua Nyarko',
      phone: '055 666 9999',
      hostel: 'Hall 6',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    },
    {
      id: '018',
      customerName: 'Kwabena Osei',
      phone: '020 444 5555',
      hostel: 'Hall 1',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'in-progress'
    },
    {
      id: '019',
      customerName: 'Adwoa Safo',
      phone: '054 111 2222',
      hostel: 'Hall 9',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'completed'
    },
    {
      id: '020',
      customerName: 'Benedicta Appiah',
      phone: '027 888 9999',
      hostel: 'Hall 7',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    }
  ];

  const data = tableData || defaultTableData;
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleStudentPress = useCallback((student: StudentItem) => {
    setSelectedStudent(student);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedStudent(null);
  }, []);

  const handleLocationPress = useCallback((student: StudentItem) => {
    // Notify parent to show hostel on map
    if (onStudentPress) {
      onStudentPress(student);
    }
  }, [onStudentPress]);

  const renderStudentItem = useCallback(({ item }: { item: StudentItem }) => (
    <View style={styles.studentItemContainer}>
      <View style={styles.studentInfoRow}>
        <View style={styles.studentLeftSection}>
          <Text style={styles.idText}>#{item.id}</Text>
          <View>
            <Text style={styles.nameText}>{item.customerName}</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.phoneText}>{item.phone}</Text>
              <View style={styles.separator} />
              <Text style={styles.hostelText}>{item.hostel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.studentRightSection}>
          <Text style={styles.priceText}>{item.price}</Text>
          
          {/* Call Icon */}
          <TouchableOpacity onPress={() => handleStudentPress(item)}>
            <Svg width="16" height="16" viewBox="0 0 12 12" fill="none">
              <Path d="M5.525 7.475L4.6 8.4C4.405 8.595 4.095 8.595 3.895 8.405C3.84 8.35 3.785 8.3 3.73 8.245C3.215 7.725 2.75 7.18 2.335 6.61C1.925 6.04 1.595 5.47 1.355 4.905C1.12 4.335 1 3.79 1 3.27C1 2.93 1.06 2.605 1.18 2.305C1.3 2 1.49 1.72 1.755 1.47C2.075 1.155 2.425 1 2.795 1C2.935 1 3.075 1.03 3.2 1.09C3.33 1.15 3.445 1.24 3.535 1.37L4.695 3.005C4.785 3.13 4.85 3.245 4.895 3.355C4.94 3.46 4.965 3.565 4.965 3.66C4.965 3.78 4.93 3.9 4.86 4.015C4.795 4.13 4.7 4.25 4.58 4.37L4.2 4.765C4.145 4.82 4.12 4.885 4.12 4.965C4.12 5.005 4.125 5.04 4.135 5.08C4.15 5.12 4.165 5.15 4.175 5.18C4.265 5.345 4.42 5.56 4.64 5.82C4.865 6.08 5.105 6.345 5.365 6.61C5.415 6.66 5.47 6.71 5.52 6.76C5.72 6.955 5.725 7.275 5.525 7.475Z" fill="#FF9933" />
              <Path d="M10.9848 9.165C10.9848 9.305 10.9598 9.45 10.9098 9.59C10.8948 9.63 10.8798 9.67 10.8598 9.71C10.7748 9.89 10.6648 10.06 10.5198 10.22C10.2748 10.49 10.0048 10.685 9.6998 10.81C9.6948 10.81 9.6898 10.815 9.6848 10.815C9.3898 10.935 9.0698 11 8.7248 11C8.2148 11 7.6698 10.88 7.0948 10.635C6.5198 10.39 5.9448 10.06 5.3748 9.645C5.1798 9.5 4.9848 9.355 4.7998 9.2L6.4348 7.565C6.5748 7.67 6.6998 7.75 6.8048 7.805C6.8298 7.815 6.8598 7.83 6.8948 7.845C6.9348 7.86 6.9748 7.865 7.0198 7.865C7.1048 7.865 7.1698 7.835 7.2248 7.78L7.6048 7.405C7.7298 7.28 7.8498 7.185 7.9648 7.125C8.0798 7.055 8.1948 7.02 8.3198 7.02C8.4148 7.02 8.5148 7.04 8.6248 7.085C8.7348 7.13 8.8498 7.195 8.9748 7.28L10.6298 8.455C10.7598 8.545 10.8498 8.65 10.9048 8.775C10.9548 8.9 10.9848 9.025 10.9848 9.165Z" fill="#FF9933" />
            </Svg>
          </TouchableOpacity>

          {/* Location Icon - Shows hostel on map */}
          <TouchableOpacity onPress={() => handleLocationPress(item)}>
            <Svg width="16" height="16" viewBox="0 0 12 12" fill="none">
              <Path d="M10.3096 4.225C9.78456 1.915 7.76956 0.875 5.99956 0.875C5.99956 0.875 5.99956 0.875 5.99456 0.875C4.22956 0.875 2.20956 1.91 1.68456 4.22C1.09956 6.8 2.67956 8.985 4.10956 10.36C4.63956 10.87 5.31956 11.125 5.99956 11.125C6.67956 11.125 7.35956 10.87 7.88456 10.36C9.31456 8.985 10.8946 6.805 10.3096 4.225ZM5.99956 6.73C5.12956 6.73 4.42456 6.025 4.42456 5.155C4.42456 4.285 5.12956 3.58 5.99956 3.58C6.86956 3.58 7.57456 4.285 7.57456 5.155C7.57456 6.025 6.86956 6.73 5.99956 6.73Z" fill="#4DB448" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [handleStudentPress, handleLocationPress]);

  return (
    <>
      <FlatList
        data={data}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        nestedScrollEnabled={true}
      />

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <StudentModal student={selectedStudent} onClose={handleCloseModal} />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    width: 320,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  modalHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.9)',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
  },
  modalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.5)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.9)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  callActionButton: {
    backgroundColor: '#FF9933',
  },
  whatsappActionButton: {
    backgroundColor: '#4DB448',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.7)',
  },
  listContainer: {
    gap: 12,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
  },
  studentItemContainer: {
    gap: 16,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 12
  },
  studentLeftSection: {
    flexDirection: 'row',
    gap: 12,
    flex: 1
  },
  studentRightSection: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  idText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)'
  },
  nameText: {
    fontSize: 14,
    color: 'rgba(0,0,0,1)',
    fontWeight: '500'
  },
  contactInfo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  phoneText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)'
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  hostelText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)'
  },
  sizeText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.5)',
    padding: 4,
    backgroundColor: '#fafafa',
    borderRadius: 8
  },
  priceText: {
    fontSize: 14,
    color: 'rgba(0,0,0,1)',
    fontWeight: '600'
  },
  dashedSeparator: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.2)',
    marginLeft: 14
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  callModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  callModalContent: {
    width: 300,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
  },
  callModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.9)',
    marginBottom: 8,
    textAlign: 'center',
  },
  callModalPhone: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
    marginBottom: 24,
  },
  callModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '500',
  },
  callButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FF9933',
    borderRadius: 8,
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default Table;