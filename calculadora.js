document.addEventListener('DOMContentLoaded', function() {
    
    const WHATSAPP_NUMBER = "5541996291417";
    let calculoPendente = null;

    // --- MÁSCARAS DE MOEDA ---
    const inputs = ['inputValorImovel', 'inputEntrada', 'inputValorExtra', 'inputRendaMensal', 'inputEntradaRenda'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, "");
                value = (value/100).toFixed(2) + "";
                value = value.replace(".", ",");
                value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
                e.target.value = value === "NaN" ? "" : "R$ " + value;
            });
        }
    });

    function cleanNumber(val) {
        if(!val) return 0;
        return parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    // --- NAVEGAÇÃO POR ABAS ---
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('resultadoBox').classList.add('hidden');
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.remove('hidden');
        });
    });

    // --- MOTOR DE CÁLCULO (SAC e PRICE) ---
    function simularFinanciamento(saldoInicial, prazoAnos, taxaAnual, sistema, extraMensal) {
        let saldoDevedor = saldoInicial;
        let prazoMeses = prazoAnos * 12;
        let taxaMensal = (taxaAnual / 100) / 12;
        
        let totalJuros = 0;
        let mesesDecorridos = 0;
        let primeiraParcela = 0;
        let ultimaParcela = 0;

        while (saldoDevedor > 0.01 && mesesDecorridos < prazoMeses) {
            mesesDecorridos++;
            
            let jurosMes = saldoDevedor * taxaMensal;
            let amortizacao = 0;
            let parcela = 0;

            if (sistema === 'sac') {
                amortizacao = saldoInicial / (prazoAnos * 12); 
                parcela = amortizacao + jurosMes;
            } else {
                let potencia = Math.pow(1 + taxaMensal, prazoMeses);
                let pmtPrice = saldoInicial * ( (taxaMensal * potencia) / (potencia - 1) );
                parcela = pmtPrice;
                amortizacao = parcela - jurosMes;
            }

            if(mesesDecorridos === 1) primeiraParcela = parcela;

            let amortizacaoTotal = amortizacao + extraMensal;
            
            if (amortizacaoTotal >= saldoDevedor) {
                amortizacaoTotal = saldoDevedor;
                parcela = amortizacaoTotal + jurosMes; 
                saldoDevedor = 0; 
            } else {
                saldoDevedor -= amortizacaoTotal;
            }

            totalJuros += jurosMes;
            if(parcela > 0) ultimaParcela = parcela;
        }

        return {
            totalJuros: totalJuros,
            mesesReais: mesesDecorridos,
            parcelaInicial: primeiraParcela,
            parcelaFinal: ultimaParcela
        };
    }

    // --- SUBMIT DO FORMULÁRIO IMÓVEL ---
    document.getElementById('formImovel').addEventListener('submit', (e) => {
        e.preventDefault();
        const imovel = cleanNumber(document.getElementById('inputValorImovel').value);
        const entrada = cleanNumber(document.getElementById('inputEntrada').value);
        const extra = cleanNumber(document.getElementById('inputValorExtra').value);
        const anos = parseFloat(document.getElementById('inputPrazo').value);
        const sistema = document.getElementById('selectSistema').value;
        
        let taxaJuros = parseFloat(document.getElementById('inputTaxa').value);
        if(!taxaJuros || isNaN(taxaJuros)) taxaJuros = 9.5;

        if(imovel <= 0 || entrada >= imovel) { alert("A entrada deve ser menor que o valor do imóvel."); return; }

        const financiado = imovel - entrada;
        const cenarioNormal = simularFinanciamento(financiado, anos, taxaJuros, sistema, 0);
        const cenarioTurbo = simularFinanciamento(financiado, anos, taxaJuros, sistema, extra);

        calculoPendente = {
            tipo: 'imovel', imovel: imovel, normal: cenarioNormal, turbo: cenarioTurbo, extra: extra, sistema: sistema, taxa: taxaJuros
        };
        verificarLead();
    });

    // --- SUBMIT DO FORMULÁRIO RENDA ---
    document.getElementById('formRenda').addEventListener('submit', (e) => {
        e.preventDefault();
        const renda = cleanNumber(document.getElementById('inputRendaMensal').value);
        const entrada = cleanNumber(document.getElementById('inputEntradaRenda').value);
        let taxaJuros = parseFloat(document.getElementById('inputTaxaRenda').value);
        if(!taxaJuros || isNaN(taxaJuros)) taxaJuros = 9.5;
        
        const parcelaMax = renda * 0.30;
        const taxaMensal = (taxaJuros / 100) / 12;
        const potencia = Math.pow(1 + taxaMensal, 360);
        const valorFinanciavel = parcelaMax * ( (potencia - 1) / (taxaMensal * potencia) );
        
        calculoPendente = { tipo: 'renda', potencial: valorFinanciavel + entrada, renda: renda, taxa: taxaJuros };
        verificarLead();
    });

    // --- CONTROLE DO MODAL ---
    function verificarLead() {
        if(localStorage.getItem('izi_lead_ok') === 'true') {
            mostrarResultado();
        } else {
            document.getElementById('modal-lead').classList.remove('hidden');
        }
    }
    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('modal-lead').classList.add('hidden'));
    
    // --- ENVIO DO LEAD (INTEGRAÇÃO SHEET MONKEY) ---
    document.getElementById('formLead').addEventListener('submit', (e) => {
        e.preventDefault();

        // Feedback visual no botão
        const btn = e.target.querySelector('button');
        const textoOriginal = btn.innerText;
        btn.innerText = "Enviando...";
        btn.disabled = true;
        
        const nome = document.getElementById('leadNome').value;
        const email = document.getElementById('leadEmail').value;

        // Prepara os dados organizados para a Planilha
        const dadosParaPlanilha = {
            'Data': new Date().toLocaleString('pt-BR'),
            'Nome': nome,
            'Email': email,
            'Tipo': calculoPendente.tipo === 'imovel' ? 'Simulação Imóvel' : 'Análise Renda',
            'Valor Imóvel': calculoPendente.imovel ? "R$ " + calculoPendente.imovel : '-',
            'Renda': calculoPendente.renda ? "R$ " + calculoPendente.renda : '-',
            'Valor Extra': calculoPendente.extra ? "R$ " + calculoPendente.extra : '0',
            'Juros': calculoPendente.taxa ? calculoPendente.taxa + "%" : '-',
            'Sistema': calculoPendente.sistema ? calculoPendente.sistema.toUpperCase() : '-'
        };

        // Envia para o Sheet Monkey (URL Inserida)
        fetch('https://api.sheetmonkey.io/form/eMvHQotQoBvTkRNScSMEyw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosParaPlanilha),
        }).then(() => {
            console.log("Lead salvo na planilha com sucesso!");
            
            // Salva cookie local para não pedir de novo
            localStorage.setItem('izi_lead_ok', 'true');
            
            // Dispara evento no Facebook (Pixel) e GTM
            if(window.dataLayer) window.dataLayer.push({'event': 'novo_lead_cadastrado'});
            
            // Fecha modal e mostra resultado
            document.getElementById('modal-lead').classList.add('hidden');
            mostrarResultado();

            // Restaura botão
            btn.innerText = textoOriginal;
            btn.disabled = false;
        }).catch(err => {
            console.error("Erro ao salvar na planilha:", err);
            // Mesmo se der erro na planilha, mostra o resultado para o cliente não travar
            document.getElementById('modal-lead').classList.add('hidden');
            mostrarResultado();
            btn.innerText = textoOriginal;
            btn.disabled = false;
        });
    });

    // --- EXIBIR RESULTADO NA TELA ---
    function mostrarResultado() {
        const box = document.getElementById('resultadoBox');
        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        box.classList.remove('hidden');
        let msgZap = "";

        if(calculoPendente.tipo === 'imovel') {
            document.getElementById('resConteudoImovel').classList.remove('hidden');
            document.getElementById('resConteudoRenda').classList.add('hidden');
            
            const normal = calculoPendente.normal;
            document.getElementById('txtParcela').innerText = fmt.format(normal.parcelaInicial);
            document.getElementById('txtUltimaParcela').innerText = fmt.format(normal.parcelaFinal);

            if(calculoPendente.extra > 0) {
                document.getElementById('boxEconomia').classList.remove('hidden');
                document.getElementById('txtValorExtraDisplay').innerText = fmt.format(calculoPendente.extra);
                document.getElementById('txtEconomiaTotal').innerText = fmt.format(normal.totalJuros - calculoPendente.turbo.totalJuros);
                
                let anosEco = ((normal.mesesReais - calculoPendente.turbo.mesesReais)/12).toFixed(1);
                if(anosEco < 0) anosEco = 0;
                document.getElementById('txtAnosEconomizados').innerText = anosEco;
                
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()} a ${calculoPendente.taxa}%) um imóvel de ${fmt.format(calculoPendente.imovel)}. Com extra de ${fmt.format(calculoPendente.extra)}, economizo juros!`;
            } else {
                document.getElementById('boxEconomia').classList.add('hidden');
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()} a ${calculoPendente.taxa}%) um imóvel de ${fmt.format(calculoPendente.imovel)}.`;
            }
        } else {
            document.getElementById('resConteudoImovel').classList.add('hidden');
            document.getElementById('resConteudoRenda').classList.remove('hidden');
            document.getElementById('txtPotencial').innerText = fmt.format(calculoPendente.potencial);
            msgZap = `Tenho renda de ${fmt.format(calculoPendente.renda)} e busco imóvel até ${fmt.format(calculoPendente.potencial)}.`;
        }
        document.getElementById('btnZap').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msgZap)}`;
        box.scrollIntoView({ behavior: 'smooth' });
    }
});