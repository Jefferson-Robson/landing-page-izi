document.addEventListener('DOMContentLoaded', function() {
    
    const WHATSAPP_NUMBER = "5541996291417";
    let calculoPendente = null;

    // --- MÁSCARAS ---
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

    // --- ABAS ---
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

    // --- MOTOR DE CÁLCULO (HÍBRIDO: SAC e PRICE) ---
    function simularFinanciamento(saldoInicial, prazoAnos, taxaAnual, sistema, extraMensal) {
        let saldoDevedor = saldoInicial;
        let prazoMeses = prazoAnos * 12;
        let taxaMensal = (taxaAnual / 100) / 12;
        
        let totalJuros = 0;
        let mesesDecorridos = 0;
        let primeiraParcela = 0;
        let ultimaParcela = 0;

        // Loop mês a mês
        while (saldoDevedor > 1 && mesesDecorridos < prazoMeses) {
            mesesDecorridos++;
            
            let jurosMes = saldoDevedor * taxaMensal;
            let amortizacao = 0;
            let parcela = 0;

            if (sistema === 'sac') {
                // SAC: Amortização constante
                amortizacao = saldoInicial / (prazoAnos * 12); 
                parcela = amortizacao + jurosMes;
            } else {
                // PRICE: Parcela fixa (baseada no prazo original)
                let potencia = Math.pow(1 + taxaMensal, prazoMeses);
                let pmtPrice = saldoInicial * ( (taxaMensal * potencia) / (potencia - 1) );
                parcela = pmtPrice;
                amortizacao = parcela - jurosMes;
            }

            if(mesesDecorridos === 1) primeiraParcela = parcela;

            // Amortização Extra
            let amortizacaoTotal = amortizacao + extraMensal;
            
            if (amortizacaoTotal > saldoDevedor) {
                amortizacaoTotal = saldoDevedor;
                parcela = amortizacaoTotal + jurosMes; 
            }

            saldoDevedor -= amortizacaoTotal;
            totalJuros += jurosMes;
            ultimaParcela = parcela;
        }

        return {
            totalJuros: totalJuros,
            mesesReais: mesesDecorridos,
            parcelaInicial: primeiraParcela,
            parcelaFinal: ultimaParcela
        };
    }

    // --- SUBMIT IMÓVEL ---
    document.getElementById('formImovel').addEventListener('submit', (e) => {
        e.preventDefault();
        const imovel = cleanNumber(document.getElementById('inputValorImovel').value);
        const entrada = cleanNumber(document.getElementById('inputEntrada').value);
        const extra = cleanNumber(document.getElementById('inputValorExtra').value);
        const anos = parseFloat(document.getElementById('inputPrazo').value);
        const sistema = document.getElementById('selectSistema').value; // 'price' ou 'sac'

        if(imovel <= 0 || entrada >= imovel) { alert("Valores inválidos."); return; }

        const financiado = imovel - entrada;

        // 1. Cenário Normal (Sem extra)
        const cenarioNormal = simularFinanciamento(financiado, anos, 9.5, sistema, 0);
        
        // 2. Cenário Turbo (Com extra)
        const cenarioTurbo = simularFinanciamento(financiado, anos, 9.5, sistema, extra);

        calculoPendente = {
            tipo: 'imovel',
            imovel: imovel,
            normal: cenarioNormal,
            turbo: cenarioTurbo,
            extra: extra,
            sistema: sistema
        };

        verificarLead();
    });

    // --- SUBMIT RENDA ---
    document.getElementById('formRenda').addEventListener('submit', (e) => {
        e.preventDefault();
        const renda = cleanNumber(document.getElementById('inputRendaMensal').value);
        const entrada = cleanNumber(document.getElementById('inputEntradaRenda').value);
        
        // Price Reverso (30% renda)
        const parcelaMax = renda * 0.30;
        const taxaMensal = (9.5 / 100) / 12;
        const potencia = Math.pow(1 + taxaMensal, 360);
        const valorFinanciavel = parcelaMax * ( (potencia - 1) / (taxaMensal * potencia) );
        
        calculoPendente = { tipo: 'renda', potencial: valorFinanciavel + entrada, renda: renda };
        verificarLead();
    });

    // --- MODAL ---
    function verificarLead() {
        if(localStorage.getItem('izi_lead_ok') === 'true') {
            mostrarResultado();
        } else {
            document.getElementById('modal-lead').classList.remove('hidden');
        }
    }
    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('modal-lead').classList.add('hidden'));
    
    document.getElementById('formLead').addEventListener('submit', (e) => {
        e.preventDefault();
        if(document.getElementById('leadNome').value) {
            localStorage.setItem('izi_lead_ok', 'true');
            if(window.dataLayer) window.dataLayer.push({'event': 'novo_lead_cadastrado'});
            document.getElementById('modal-lead').classList.add('hidden');
            mostrarResultado();
        }
    });

    // --- EXIBIR RESULTADO ---
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
                document.getElementById('txtAnosEconomizados').innerText = ((normal.mesesReais - calculoPendente.turbo.mesesReais)/12).toFixed(1);
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()}) um imóvel de ${fmt.format(calculoPendente.imovel)}. Com extra de ${fmt.format(calculoPendente.extra)}, economizo juros!`;
            } else {
                document.getElementById('boxEconomia').classList.add('hidden');
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()}) um imóvel de ${fmt.format(calculoPendente.imovel)}. 1ª Parcela: ${fmt.format(normal.parcelaInicial)}.`;
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