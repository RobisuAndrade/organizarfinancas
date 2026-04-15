import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Lista de Cômodos disponíveis
const COMODOS = ['Cozinha', 'Quarto', 'Sala', 'Banheiro', 'Escritório', 'Varanda'];

export default function Compras() {
  const router = useRouter();
  
  // Estados da Lista e do Formulário
  const [formAberto, setFormAberto] = useState(false);
  const [lista, setLista] = useState([
    { 
      id: '1', 
      nome: 'Geladeira Frost Free', 
      link: 'https://google.com', 
      prioridade: 5, 
      comodo: 'Cozinha', 
      valor: '3.500,00', 
      comprado: false 
    },
    { 
      id: '2', 
      nome: 'Lixeira de Inox', 
      link: '', 
      prioridade: 2, 
      comodo: 'Banheiro', 
      valor: '80,00', 
      comprado: true 
    },
  ]);

  // Estados dos inputs do formulário
  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [prioridade, setPrioridade] = useState(3); // Padrão 3 estrelas
  const [comodo, setComodo] = useState('Cozinha');
  const [valor, setValor] = useState('');

  const adicionarItem = () => {
    if (nome.trim().length === 0) {
      alert("O nome do item é obrigatório!");
      return;
    }
    
    const novoItem = {
      id: Math.random().toString(),
      nome, link, prioridade, comodo, valor,
      comprado: false
    };
    
    setLista([novoItem, ...lista]);
    
    // Limpa o form e fecha
    setNome(''); setLink(''); setValor(''); setPrioridade(3); setComodo('Cozinha');
    setFormAberto(false);
  };

  const alternarComprado = (id: string) => {
    const listaAtualizada = lista.map(item => 
      item.id === id ? { ...item, comprado: !item.comprado } : item
    );
    setLista(listaAtualizada);
  };

  const abrirLink = (url: string) => {
    if(url) Linking.openURL(url).catch(() => alert("Link inválido"));
  };

  // Função para desenhar as estrelas
  const renderizarEstrelas = (qtd: number, interativo = false, onSelect?: (n: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            disabled={!interativo}
            onPress={() => interativo && onSelect && onSelect(star)}
          >
            <Feather 
              name="star" 
              size={interativo ? 28 : 14} 
              color={star <= qtd ? "#FFD700" : "#444"} // Dourado se ativo, Cinza escuro se inativo
              style={styles.starIcon}
              // Usa o ícone preenchido (solid) se for selecionado. No Feather original não tem solid nativo fácil, então usamos cor forte.
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#B04FCF" />
          </TouchableOpacity>
          <Text style={styles.titulo}>Para a Nossa Casa</Text>
        </View>

        {/* Botão de abrir/fechar formulário */}
        <TouchableOpacity 
          style={styles.toggleFormButton} 
          onPress={() => setFormAberto(!formAberto)}
        >
          <Feather name={formAberto ? "x" : "plus"} size={20} color="#FFF" />
          <Text style={styles.toggleFormText}>
            {formAberto ? "Cancelar" : "Adicionar Novo Item"}
          </Text>
        </TouchableOpacity>

        {/* Formulário de Adição */}
        {formAberto && (
          <View style={styles.formContainer}>
            <TextInput style={styles.input} placeholder="Nome do item" placeholderTextColor="#666" value={nome} onChangeText={setNome} />
            
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="Valor Promoção (Ex: 150,00)" placeholderTextColor="#666" value={valor} onChangeText={setValor} keyboardType="numeric" />
            </View>

            <TextInput style={styles.input} placeholder="Link do Produto (Opcional)" placeholderTextColor="#666" value={link} onChangeText={setLink} autoCapitalize="none" />

            {/* Seletor de Prioridade */}
            <Text style={styles.label}>Prioridade (1 a 5 estrelas)</Text>
            {renderizarEstrelas(prioridade, true, setPrioridade)}

            {/* Seletor de Cômodo */}
            <Text style={styles.label}>Cômodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.comodosScroll}>
              {COMODOS.map((c) => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.comodoTag, comodo === c && styles.comodoTagActive]}
                  onPress={() => setComodo(c)}
                >
                  <Text style={[styles.comodoTagText, comodo === c && styles.comodoTagTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.submitButton} onPress={adicionarItem}>
              <Text style={styles.submitButtonText}>Salvar Item</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de Itens */}
        <FlatList 
          data={lista}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          renderItem={({ item }) => (
            <View style={[styles.itemCard, item.comprado && styles.itemCardComprado]}>
              
              <View style={styles.itemHeader}>
                {/* Checkbox de comprado */}
                <TouchableOpacity style={[styles.checkbox, item.comprado && styles.checkboxMarcado]} onPress={() => alternarComprado(item.id)}>
                  {item.comprado && <Feather name="check" size={14} color="#FFF" />}
                </TouchableOpacity>
                
                <View style={styles.itemTitleArea}>
                  <Text style={[styles.itemTexto, item.comprado && styles.itemTextoRiscado]}>{item.nome}</Text>
                  {renderizarEstrelas(item.prioridade)}
                </View>

                {/* Badge do Cômodo */}
                <View style={styles.badgeComodo}>
                  <Text style={styles.badgeComodoText}>{item.comodo}</Text>
                </View>
              </View>

              <View style={styles.itemFooter}>
                <Text style={styles.valorTexto}>
                  R$ {item.valor ? item.valor : '0,00'}
                </Text>
                
                {/* Botão de Link condicional */}
                {item.link ? (
                  <TouchableOpacity style={styles.linkButton} onPress={() => abrirLink(item.link)}>
                    <Feather name="external-link" size={14} color="#AA319C" />
                    <Text style={styles.linkButtonText}>LINK PRODUTO</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noLinkText}>Sem link</Text>
                )}
              </View>

            </View>
          )}
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0414' },
  container: { flex: 1, padding: 20, paddingTop: 40, width: '100%', maxWidth: 600, alignSelf: 'center' },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E0A24', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#2D1436' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },

  toggleFormButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C', padding: 15, borderRadius: 12, justifyContent: 'center', marginBottom: 20 },
  toggleFormText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  formContainer: { backgroundColor: '#1E0A24', padding: 20, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#2D1436' },
  input: { height: 50, backgroundColor: '#0F0414', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2D1436', marginBottom: 15 },
  row: { flexDirection: 'row' },
  label: { color: '#B04FCF', fontWeight: 'bold', fontSize: 14, marginBottom: 10, marginTop: 5 },
  
  starsContainer: { flexDirection: 'row', marginBottom: 15 },
  starIcon: { marginRight: 5 },

  comodosScroll: { flexDirection: 'row', marginBottom: 25 },
  comodoTag: { backgroundColor: '#0F0414', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#2D1436', marginRight: 10, height: 38 },
  comodoTagActive: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  comodoTagText: { color: '#888', fontWeight: '600', fontSize: 14 },
  comodoTagTextActive: { color: '#FFF' },

  submitButton: { backgroundColor: '#B04FCF', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  itemCard: { backgroundColor: '#1E0A24', padding: 18, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#2D1436' },
  itemCardComprado: { opacity: 0.5 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#B04FCF', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  checkboxMarcado: { backgroundColor: '#B04FCF', borderColor: '#B04FCF' },
  
  itemTitleArea: { flex: 1 },
  itemTexto: { fontSize: 18, color: '#FFF', fontWeight: 'bold', marginBottom: 4 },
  itemTextoRiscado: { textDecorationLine: 'line-through', color: '#666' },
  
  badgeComodo: { backgroundColor: '#2D1436', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  badgeComodoText: { color: '#B04FCF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },

  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2D1436' },
  valorTexto: { fontSize: 16, color: '#444', fontWeight: 'bold', color: '#FFF' },
  
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#AA319C20', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#AA319C' },
  linkButtonText: { color: '#AA319C', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  noLinkText: { color: '#444', fontSize: 12, fontStyle: 'italic' }
});