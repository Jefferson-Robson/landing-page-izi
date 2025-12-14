document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // CONFIGURAÇÃO: Telefone da IZI
    // ============================================
    const ZAP_NUMERO = "5541996291417"; 

    // --- 1. MÁSCARAS DE MOEDA (UX) ---
    const inputsMoeda = ['valorImovel', 'entrada', 'rendaMensal', 'valorExtra'];

    inputsMoeda.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function(e) {
                formatarMoeda(e.target);
            });
        }
    });

    function formatarMoeda(elemento) {
        let valor = elemento.value.replace(/\D/g, "");
        if (valor === "") { elemento.value = ""; return; }
        valor = (parseInt(valor) / 100).toFixed(2) + "";
        valor = valor.replace(".", ",");
        valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        elemento.value = "R$ " + valor;
    }

    function limparValor(valorFormatado) {
        if (!valorFormatado) return 0;
        const limpo = valorFormatado.replace(/[^\d,]/g, '').replace(',', '.');
        return parseFloat(limpo);
    }

    // --- 2. RASTREAMENTO DE ORIGEM (UTMs) ---
    function getUTMParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('utm_source');
        const medium = urlParams.get('utm_medium');
        
        let textoOrigem = "";
        if (source) textoOrigem += ` (Vim de: ${source}`;
        if (medium) textoOrigem += `/${medium}`;
        if (source) textoOrigem += ")";
        
        return textoOrigem;
    }

    // --- 3. ABAS (TABS) ---
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById('resultado').classList.add('hidden');
        });
    });

    // Variável global para guardar o cálculo atual
    let resultadoPendente = null;

    // --- 4. VERIFICAR SE JÁ É LEAD (LOCALSTORAGE) ---
    function verificarLeadEProcessar() {
        const jaCadastrado = localStorage.getItem('izi_lead_cadastrado');
        if (jaCadastrado === 'true') {
            mostrarResultadoNaTela();
        } else {
            abrirModal();
        }
    }

    // --- 5. EVENTOS DO FORMULÁRIO ---
    
    // Aba Imóvel
    const formImovel = document.getElementById('form-imovel');
    if(formImovel) {
        formImovel.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const V = limparValor(document.getElementById('valorImovel').value);
            const E = limparValor(document.getElementById('entrada').value);
            const Extra = limparValor(document.getElementById('valorExtra').value);
            
            const nAnos = parseFloat(document.getElementById('anos').value);
            const iAnual = parseFloat(document.getElementById('juros').value);
            const sistema = document.getElementById('tabela').value;

            if (isNaN(V) || isNaN(E)) { alert("Valores inválidos"); return; }
            if (E >= V) { alert("A entrada deve ser menor que o valor do imóvel."); return; }

            const cenarioNormal = simularFinanciamento(V - E, nAnos, iAnual, sistema, 0);
            const cenarioTurbo = simularFinanciamento(V - E, nAnos, iAnual, sistema, Extra);

            resultadoPendente = { 
                tipo: 'imovel', 
                dados: { normal: cenarioNormal, turbo: cenarioTurbo, extraMensal: Extra } 
            };
            
            verificarLeadEProcessar();
        });
    }

    // Aba Renda
    const formRenda = document.getElementById('form-renda');
    if(formRenda) {
        formRenda.addEventListener('submit', function(e) {
            e.preventDefault();
            const renda = limparValor(document.getElementById('rendaMensal').value);
            const pct = parseFloat(document.getElementById('comprometimento').value) / 100;
            const iAnual = parseFloat(document.getElementById('jurosRenda').value);
            const nAnos = parseFloat(document.getElementById('anosRenda').value);

            const parcelaMaxima = renda * pct;
            const iMensal = (iAnual / 100) / 12;
            const nMeses = nAnos * 12;
            
            const potencialFinanciamento = parcelaMaxima * ( (Math.pow(1+iMensal, nMeses) - 1) / (iMensal * Math.pow(1+iMensal, nMeses)) );
            
            resultadoPendente = { 
                tipo: 'renda', 
                dados: { valor: potencialFinanciamento, parcela: parcelaMaxima } 
            };
            
            verificarLeadEProcessar();
        });
    }

    // --- 6. MOTOR DE CÁLCULO (MÊS A MÊS) ---
    function simularFinanciamento(saldoInicial, anos, taxaAnual, sistema, pagamentoExtra) {
        let saldoDevedor = saldoInicial;
        const iMensal = (taxaAnual / 100) / 12;
        const mesesTotal = anos * 12;
        
        let totalJurosPago = 0;
        let mesesDecorridos = 0;
        let primeiraParcela = 0;
        let ultimaParcela = 0;

        while (saldoDevedor > 1 && mesesDecorridos < mesesTotal) {
            mesesDecorridos++;
            
            let jurosMes = saldoDevedor * iMensal;
            let amortizacao = 0;
            let parcela = 0;

            if (sistema === 'sac') {
                amortizacao = saldoInicial / mesesTotal; 
                parcela = amortizacao + jurosMes;
            } else {
                const pmtBase = saldoInicial * ( (iMensal * Math.pow(1 + iMensal, mesesTotal)) / (Math.pow(1 + iMensal, mesesTotal) - 1) );
                parcela = pmtBase;
                amortizacao = parcela - jurosMes;
            }

            if (mesesDecorridos === 1) primeiraParcela = parcela;

            let amortizacaoTotal = amortizacao + pagamentoExtra;
            
            if (amortizacaoTotal > saldoDevedor) {
                amortizacaoTotal = saldoDevedor;
                parcela = amortizacaoTotal + jurosMes; 
            }

            saldoDevedor -= amortizacaoTotal;
            totalJurosPago += jurosMes;
            ultimaParcela = parcela;

            if (saldoDevedor > saldoInicial) break; 
        }

        return {
            totalPago: saldoInicial + totalJurosPago,
            totalJuros: totalJurosPago,
            meses: mesesDecorridos,
            primeiraParcela: primeiraParcela,
            ultimaParcela: ultimaParcela,
            saldoInicial: saldoInicial
        };
    }

    // --- 7. MODAL, CAPTURA E TRACKING (DATA LAYER) ---
    const modal = document.getElementById('modal-lead');
    const formLead = document.getElementById('form-lead-capture');
    const closeBtn = document.querySelector('.close-modal');
    
    function abrirModal() { if(modal) modal.classList.remove('hidden'); }
    if(closeBtn) { closeBtn.addEventListener('click', () => modal.classList.add('hidden')); }
    
    if(formLead) {
        formLead.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const nomeUsuario = document.getElementById('lead-nome').value;
            const emailUsuario = document.getElementById('lead-email').value;

            // 1. Salvar localmente
            localStorage.setItem('izi_lead_cadastrado', 'true');
            localStorage.setItem('izi_lead_nome', nomeUsuario); 

            // 2. DISPARAR EVENTO PARA ANÚNCIOS (GTM/Facebook)
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                'event': 'generate_lead',
                'lead_type': resultadoPendente ? resultadoPendente.tipo : 'desconhecido',
                'user_email_hash': emailUsuario 
            });
            
            modal.classList.add('hidden');
            mostrarResultadoNaTela();
        });
    }

    // --- 8. EXIBIÇÃO DO RESULTADO ---
    function mostrarResultadoNaTela() {
        const box = document.getElementById('resultado');
        const format = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const nomeSalvo = localStorage.getItem('izi_lead_nome');
        const saudacao = nomeSalvo ? `<span style="color:var(--primary-color); font-size: 1rem;">Olá, ${nomeSalvo}!</span><br>` : '';

        // Captura origem (UTMs)
        const origemTrafego = getUTMParameters();
        let textoZap = "";

        if (resultadoPendente.tipo === 'imovel') {
            const normal = resultadoPendente.dados.normal;
            const turbo = resultadoPendente.dados.turbo;
            const extra = resultadoPendente.dados.extraMensal;

            let htmlResultado = `<div style="text-align:center; margin-bottom:15px;">${saudacao}<h4>Resultado da Simulação</h4></div>`;
            
            textoZap = `Olá! Simulei um imóvel na IZI de ${format(normal.saldoInicial)}. Parcela estimada: ${format(normal.primeiraParcela)}. `;

            htmlResultado += `
                <p>Valor Financiado: <strong>${format(normal.saldoInicial)}</strong></p>
                <div style="margin: 10px 0; padding: 10px; background: #fff; border-radius: 5px;">
                    Parcela Inicial Estimada:<br>
                    <span style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">
                        ${format(normal.primeiraParcela)}
                    </span>
                </div>
            `;

            if (extra > 0) {
                const economiaDinheiro = normal.totalPago - turbo.totalPago;
                const mesesEconomizados = normal.meses - turbo.meses;
                const anosEconomizados = (mesesEconomizados / 12).toFixed(1);

                htmlResultado += `
                    <div style="background-color: #e3fcec; border: 1px solid #00d26a; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h5 style="color: #006633; margin-bottom: 5px;"><i class="fas fa-bolt"></i> Poder do Pagamento Extra</h5>
                        <p style="font-size: 0.9rem;">Com <strong>+ ${format(extra)}</strong> mensais:</p>
                        
                        <ul style="text-align: left; margin-top: 10px; list-style: none;">
                            <li style="margin-bottom: 5px;">
                                💰 Você economiza: <strong style="color: #00d26a; font-size: 1.1rem;">${format(economiaDinheiro)}</strong>
                            </li>
                            <li>
                                ⏱️ Termina em: <strong>${turbo.meses} meses</strong> (menos ${anosEconomizados} anos!)
                            </li>
                        </ul>
                    </div>
                `;
                textoZap += `Vi que pagando ${format(extra)} extra, economizo ${format(economiaDinheiro)}. Gostaria de saber mais! ${origemTrafego}`;
            } else {
                htmlResultado += `
                    <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                        Total em Juros: ${format(normal.totalJuros)}<br>
                        Prazo: ${normal.meses} meses
                    </p>
                `;
                textoZap += `Prazo total de ${normal.meses} meses. ${origemTrafego}`;
            }

            const linkZap = `https://wa.me/${ZAP_NUMERO}?text=${encodeURIComponent(textoZap)}`;

            htmlResultado += `
                <a href="${linkZap}" target="_blank" class="btn-full" style="background-color: #25D366; margin-top: 15px; display:inline-block; text-decoration:none; color:white;">
                    <i class="fab fa-whatsapp"></i> Enviar para Corretor
                </a>
            `;
            box.innerHTML = htmlResultado;

        } else {
            const d = resultadoPendente.dados;
            textoZap = `Olá! Fiz a simulação por renda. Tenho renda para financiar aprox ${format(d.valor)}. ${origemTrafego}`;
            const linkZap = `https://wa.me/${ZAP_NUMERO}?text=${encodeURIComponent(textoZap)}`;

            box.innerHTML = `
                ${saudacao}
                <h4>Potencial de Compra</h4>
                <p>Baseado na sua renda, seu poder de financiamento é de aprox:</p>
                <div style="font-size:1.8rem; color:var(--primary-color); font-weight:bold; margin:10px 0;">
                    ${format(d.valor)}
                </div>
                <p><small>Parcela máxima sugerida: ${format(d.parcela)}</small></p>
                
                <a href="${linkZap}" target="_blank" class="btn-full" style="background-color: #25D366; margin-top: 15px; display:inline-block; text-decoration:none; color:white;">
                    <i class="fab fa-whatsapp"></i> Falar com Especialista
                </a>
            `;
        }
        
        box.classList.remove('hidden');
        box.scrollIntoView({ behavior: 'smooth' });
    }

    // --- 9. AÇÃO DO BOTÃO DE RODAPÉ (NOVO) ---
    const btnFooter = document.getElementById('btn-footer-relatorio');
    
    if(btnFooter) {
        btnFooter.addEventListener('click', function() {
            // Verifica se já existe um cálculo na memória
            if (resultadoPendente) {
                // Se já calculou, segue o fluxo normal (verifica lead ou abre modal)
                verificarLeadEProcessar();
            } else {
                // Se NÃO calculou, leva a pessoa até a calculadora
                const simulador = document.getElementById('simulador');
                simulador.scrollIntoView({ behavior: 'smooth' });
                
                // Dá um pequeno alerta visual ou foco
                document.getElementById('valorImovel').focus();
                
                // Opcional: Alerta suave
                alert("Por favor, preencha os dados da simulação primeiro para gerarmos seu relatório personalizado! 🚀");
            }
        });
    }
});